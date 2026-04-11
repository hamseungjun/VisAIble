import hashlib
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.schemas.competition import (
    CompetitionCreateRequest,
    CompetitionEnterRequest,
    CompetitionLeaderboardEntry,
    CompetitionLeaderboardResponse,
    CompetitionParticipantResponse,
    CompetitionRoomResponse,
    CompetitionScoredSubmissionRequest,
    CompetitionSubmissionResponse,
)


DB_PATH = Path(__file__).resolve().parents[2] / "data" / "competition.sqlite3"
KST = timezone(timedelta(hours=9))
SUPPORTED_DATASETS = {"mnist", "fashion_mnist", "cifar10", "imagenet"}


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_competition_db() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS competition_rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_code TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                dataset_id TEXT NOT NULL,
                host_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                starts_at TEXT,
                ends_at TEXT,
                created_at TEXT NOT NULL,
                host_participant_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS competition_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT,
                joined_at TEXT NOT NULL,
                UNIQUE(room_id, display_name),
                FOREIGN KEY(room_id) REFERENCES competition_rooms(id)
            );

            CREATE TABLE IF NOT EXISTS competition_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                participant_id INTEGER NOT NULL,
                job_id TEXT NOT NULL UNIQUE,
                optimizer TEXT NOT NULL,
                batch_size INTEGER NOT NULL,
                train_accuracy REAL NOT NULL,
                validation_accuracy REAL NOT NULL,
                public_score REAL NOT NULL,
                private_score REAL NOT NULL,
                is_baseline INTEGER NOT NULL DEFAULT 0,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY(room_id) REFERENCES competition_rooms(id),
                FOREIGN KEY(participant_id) REFERENCES competition_participants(id)
            );
            """
        )
        participant_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(competition_participants)").fetchall()
        }
        if "password_hash" not in participant_columns:
            connection.execute("ALTER TABLE competition_participants ADD COLUMN password_hash TEXT")


def _now_iso() -> str:
    return datetime.now(KST).isoformat()


def _parse_kst_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=KST)
    return parsed.astimezone(KST)


def _normalize_room_code(value: str | None) -> str:
    if not value:
        return secrets.token_hex(3).upper()
    normalized = "".join(char for char in value.upper() if char.isalnum())
    if len(normalized) < 4:
        raise ValueError("Room code must contain at least 4 alphanumeric characters")
    return normalized[:12]


def _validate_dataset_id(dataset_id: str) -> str:
    if dataset_id not in SUPPORTED_DATASETS:
        raise ValueError(f"Competition dataset '{dataset_id}' is not supported")
    return dataset_id


def _generate_password() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(12))


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _verify_password(password: str, password_hash: str) -> bool:
    return _hash_password(password) == password_hash


def _room_status(starts_at: str | None, ends_at: str | None) -> bool:
    now = datetime.now(KST)
    if starts_at:
        start = _parse_kst_datetime(starts_at)
        if start > now:
            return False
    if ends_at:
        end = _parse_kst_datetime(ends_at)
        if end < now:
            return False
    return True


def _ensure_room_schedule_is_valid(starts_at: str | None, ends_at: str | None) -> None:
    now = datetime.now(timezone.utc)

    if starts_at:
        start = datetime.fromisoformat(starts_at)
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if start < now and (now - start).total_seconds() > 60:
            raise ValueError("Competition start time must be in the future or current time")

    if ends_at:
        end = datetime.fromisoformat(ends_at)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end <= now:
            raise ValueError("Competition end time must be later than the current time")

    if starts_at and ends_at:
        start = datetime.fromisoformat(starts_at)
        end = datetime.fromisoformat(ends_at)
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        if end <= start:
            raise ValueError("Competition end time must be later than the start time")


def _serialize_participants(connection: sqlite3.Connection, room_id: int) -> list[CompetitionParticipantResponse]:
    rows = connection.execute(
        """
        SELECT id, display_name, role, joined_at
        FROM competition_participants
        WHERE room_id = ?
        ORDER BY CASE WHEN role = 'host' THEN 0 ELSE 1 END, joined_at ASC
        """,
        (room_id,),
    ).fetchall()
    return [
        CompetitionParticipantResponse(
            id=row["id"],
            displayName=row["display_name"],
            role=row["role"],
            joinedAt=row["joined_at"],
        )
        for row in rows
    ]


def create_competition_room(payload: CompetitionCreateRequest) -> CompetitionRoomResponse:
    init_competition_db()
    dataset_id = _validate_dataset_id(payload.datasetId)
    room_code = _normalize_room_code(payload.roomCode)
    password = payload.password or _generate_password()
    created_at = _now_iso()
    _ensure_room_schedule_is_valid(payload.startsAt, payload.endsAt)

    with _connect() as connection:
        existing = connection.execute(
            "SELECT 1 FROM competition_rooms WHERE room_code = ?",
            (room_code,),
        ).fetchone()
        if existing is not None:
            raise ValueError("Room code already exists")

        cursor = connection.execute(
            """
            INSERT INTO competition_rooms (
                room_code, title, dataset_id, host_name, password_hash, starts_at, ends_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room_code,
                payload.title,
                dataset_id,
                payload.hostName,
                _hash_password(password),
                payload.startsAt,
                payload.endsAt,
                created_at,
            ),
        )
        room_id = int(cursor.lastrowid)
        participant_cursor = connection.execute(
            """
            INSERT INTO competition_participants (room_id, display_name, role, password_hash, joined_at)
            VALUES (?, ?, 'host', NULL, ?)
            """,
            (room_id, payload.hostName, created_at),
        )
        participant_id = int(participant_cursor.lastrowid)
        connection.execute(
            "UPDATE competition_rooms SET host_participant_id = ? WHERE id = ?",
            (participant_id, room_id),
        )

        return CompetitionRoomResponse(
            roomCode=room_code,
            title=payload.title,
            datasetId=dataset_id,
            hostName=payload.hostName,
            hostParticipantId=participant_id,
            participantId=participant_id,
            participantName=payload.hostName,
            participantRole="host",
            startsAt=payload.startsAt,
            endsAt=payload.endsAt,
            createdAt=created_at,
            isActive=_room_status(payload.startsAt, payload.endsAt),
            participants=_serialize_participants(connection, room_id),
            generatedPassword=password,
        )


def enter_competition_room(payload: CompetitionEnterRequest) -> CompetitionRoomResponse:
    init_competition_db()
    room_code = _normalize_room_code(payload.roomCode)

    with _connect() as connection:
        room = connection.execute(
            """
            SELECT id, title, dataset_id, host_name, password_hash, starts_at, ends_at, created_at, host_participant_id
            FROM competition_rooms
            WHERE room_code = ?
            """,
            (room_code,),
        ).fetchone()
        if room is None:
            raise ValueError("Competition room not found")
        if payload.participantName == str(room["host_name"]):
            if not _verify_password(payload.password, str(room["password_hash"])):
                raise ValueError("Host password is incorrect")
            participant_id = int(room["host_participant_id"])
            participant_role = "host"
        else:
            existing = connection.execute(
                """
                SELECT id, role, password_hash
                FROM competition_participants
                WHERE room_id = ? AND display_name = ?
                """,
                (room["id"], payload.participantName),
            ).fetchone()
            if existing is None:
                joined_at = _now_iso()
                cursor = connection.execute(
                    """
                    INSERT INTO competition_participants (room_id, display_name, role, password_hash, joined_at)
                    VALUES (?, ?, 'member', ?, ?)
                    """,
                    (room["id"], payload.participantName, _hash_password(payload.password), joined_at),
                )
                participant_id = int(cursor.lastrowid)
                participant_role = "member"
            else:
                if str(existing["role"]) != "member":
                    raise ValueError("Host account must use the host password")
                stored_password_hash = existing["password_hash"]
                if not stored_password_hash or not _verify_password(payload.password, str(stored_password_hash)):
                    raise ValueError("Participant password is incorrect")
                participant_id = int(existing["id"])
                participant_role = "member"

        return CompetitionRoomResponse(
            roomCode=room_code,
            title=str(room["title"]),
            datasetId=str(room["dataset_id"]),
            hostName=str(room["host_name"]),
            hostParticipantId=int(room["host_participant_id"]),
            participantId=participant_id,
            participantName=payload.participantName,
            participantRole=participant_role,
            startsAt=room["starts_at"],
            endsAt=room["ends_at"],
            createdAt=str(room["created_at"]),
            isActive=_room_status(room["starts_at"], room["ends_at"]),
            participants=_serialize_participants(connection, int(room["id"])),
            generatedPassword=None,
        )


def get_competition_room(room_code: str, participant_id: int | None = None) -> CompetitionRoomResponse:
    init_competition_db()
    normalized = _normalize_room_code(room_code)

    with _connect() as connection:
        room = connection.execute(
            """
            SELECT id, title, dataset_id, host_name, starts_at, ends_at, created_at, host_participant_id
            FROM competition_rooms
            WHERE room_code = ?
            """,
            (normalized,),
        ).fetchone()
        if room is None:
            raise ValueError("Competition room not found")

        participant = None
        if participant_id is not None:
            participant = connection.execute(
                """
                SELECT id, display_name, role
                FROM competition_participants
                WHERE id = ? AND room_id = ?
                """,
                (participant_id, room["id"]),
            ).fetchone()

        return CompetitionRoomResponse(
            roomCode=normalized,
            title=str(room["title"]),
            datasetId=str(room["dataset_id"]),
            hostName=str(room["host_name"]),
            hostParticipantId=int(room["host_participant_id"]),
            participantId=int(participant["id"]) if participant is not None else int(room["host_participant_id"]),
            participantName=str(participant["display_name"]) if participant is not None else str(room["host_name"]),
            participantRole=str(participant["role"]) if participant is not None else "host",
            startsAt=room["starts_at"],
            endsAt=room["ends_at"],
            createdAt=str(room["created_at"]),
            isActive=_room_status(room["starts_at"], room["ends_at"]),
            participants=_serialize_participants(connection, int(room["id"])),
            generatedPassword=None,
        )


def submit_scored_competition_run(payload: CompetitionScoredSubmissionRequest) -> CompetitionSubmissionResponse:
    init_competition_db()
    normalized = _normalize_room_code(payload.roomCode)

    with _connect() as connection:
        room = connection.execute(
            """
            SELECT id, room_code, dataset_id, starts_at, ends_at, host_participant_id
            FROM competition_rooms
            WHERE room_code = ?
            """,
            (normalized,),
        ).fetchone()
        if room is None:
            raise ValueError("Competition room not found")
        if str(room["dataset_id"]) != payload.datasetId:
            raise ValueError("Competition submissions must use the room dataset")
        if not _room_status(room["starts_at"], room["ends_at"]):
            raise ValueError("Competition room is not active")

        participant = connection.execute(
            """
            SELECT id, display_name, role
            FROM competition_participants
            WHERE id = ? AND room_id = ?
            """,
            (payload.participantId, room["id"]),
        ).fetchone()
        if participant is None:
            raise ValueError("Competition participant was not found in this room")

        existing_baseline = connection.execute(
            """
            SELECT 1
            FROM competition_submissions
            WHERE room_id = ? AND participant_id = ?
            LIMIT 1
            """,
            (room["id"], room["host_participant_id"]),
        ).fetchone()
        is_baseline = int(participant["role"] == "host" and existing_baseline is None)
        submitted_at = _now_iso()

        cursor = connection.execute(
            """
            INSERT INTO competition_submissions (
                room_id, participant_id, job_id, optimizer, batch_size,
                train_accuracy, validation_accuracy, public_score, private_score, is_baseline, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                room["id"],
                participant["id"],
                payload.jobId,
                payload.optimizer,
                payload.batchSize,
                payload.trainAccuracy,
                payload.validationAccuracy,
                payload.publicScore,
                payload.privateScore,
                is_baseline,
                submitted_at,
            ),
        )

        return CompetitionSubmissionResponse(
            submissionId=int(cursor.lastrowid),
            roomCode=normalized,
            participantId=int(participant["id"]),
            participantName=str(participant["display_name"]),
            isBaseline=bool(is_baseline),
            trainAccuracy=round(float(payload.trainAccuracy), 4),
            validationAccuracy=round(float(payload.validationAccuracy), 4),
            publicScore=round(float(payload.publicScore), 4),
            privateScore=round(float(payload.privateScore), 4) if str(participant["role"]) == "host" else None,
            submittedAt=submitted_at,
        )


def get_competition_leaderboard(
    room_code: str,
    participant_id: int | None = None,
) -> CompetitionLeaderboardResponse:
    init_competition_db()
    normalized = _normalize_room_code(room_code)

    with _connect() as connection:
        room = connection.execute(
            """
            SELECT id, title, host_name, dataset_id, starts_at, ends_at
            FROM competition_rooms
            WHERE room_code = ?
            """,
            (normalized,),
        ).fetchone()
        if room is None:
            raise ValueError("Competition room not found")

        requester_role = "member"
        if participant_id is not None:
            requester = connection.execute(
                """
                SELECT role
                FROM competition_participants
                WHERE id = ? AND room_id = ?
                """,
                (participant_id, room["id"]),
            ).fetchone()
            if requester is not None:
                requester_role = str(requester["role"])

        rows = connection.execute(
            """
            SELECT *
            FROM (
                SELECT
                    p.id AS participant_id,
                    p.display_name,
                    p.role,
                    s.public_score,
                    s.private_score,
                    s.train_accuracy,
                    s.validation_accuracy,
                    s.optimizer,
                    s.batch_size,
                    s.is_baseline,
                    s.submitted_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY p.id
                        ORDER BY s.private_score DESC, s.public_score DESC, s.submitted_at ASC
                    ) AS row_number
                FROM competition_participants p
                LEFT JOIN competition_submissions s ON s.participant_id = p.id
                WHERE p.room_id = ?
            )
            WHERE row_number = 1 AND public_score IS NOT NULL
            ORDER BY private_score DESC, public_score DESC, submitted_at ASC
            """,
            (room["id"],),
        ).fetchall()

        entries = [
            CompetitionLeaderboardEntry(
                participantId=int(row["participant_id"]),
                participantName=str(row["display_name"]),
                role=str(row["role"]),
                rank=index,
                publicScore=round(float(row["public_score"]), 4),
                privateScore=round(float(row["private_score"]), 4) if requester_role == "host" else None,
                trainAccuracy=round(float(row["train_accuracy"]), 4),
                validationAccuracy=round(float(row["validation_accuracy"]), 4),
                optimizer=str(row["optimizer"]),
                batchSize=int(row["batch_size"]),
                isBaseline=bool(row["is_baseline"]),
                submittedAt=str(row["submitted_at"]),
            )
            for index, row in enumerate(rows, start=1)
        ]

        return CompetitionLeaderboardResponse(
            roomCode=normalized,
            title=str(room["title"]),
            hostName=str(room["host_name"]),
            datasetId=str(room["dataset_id"]),
            startsAt=room["starts_at"],
            endsAt=room["ends_at"],
            isActive=_room_status(room["starts_at"], room["ends_at"]),
            entries=entries,
        )
