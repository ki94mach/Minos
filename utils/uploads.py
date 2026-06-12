"""
Disk storage helpers for node reference files (PDF/Word).

Files live under ``UPLOAD_FOLDER/<patient_id>/<node_id>/<stored_name>`` where
``stored_name`` is a server-generated UUID. User-supplied filenames are never
used to build paths (only kept as ``original_name`` for the download name).
"""

from __future__ import annotations

import os
import shutil
import uuid
from typing import Optional, Tuple

from flask import current_app
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

# Allowed reference file types: extension -> set of acceptable MIME types.
ALLOWED_FILE_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
}

# Canonical MIME type per extension, used as a fallback when the client omits one.
DEFAULT_MIME_BY_EXT = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
}

# Max upload size in bytes (mirrors Flask MAX_CONTENT_LENGTH default of 10MB).
MAX_FILE_BYTES = 10 * 1024 * 1024


class UploadError(ValueError):
    """Raised when an uploaded file fails validation."""


def _upload_root() -> str:
    root = current_app.config.get("UPLOAD_FOLDER")
    if not root:
        raise UploadError("Upload directory is not configured.")
    return root


def _ext(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def validate_upload(file: FileStorage) -> Tuple[str, str]:
    """
    Validate an uploaded file's extension and MIME type.

    Returns ``(extension, original_name)``; raises ``UploadError`` otherwise.
    Size is primarily enforced by Flask MAX_CONTENT_LENGTH, but this also guards
    against oversized streams when content length is unknown.
    """
    if file is None or not file.filename:
        raise UploadError("No file provided.")

    original_name = secure_filename(file.filename)
    if not original_name:
        raise UploadError("Invalid file name.")

    extension = _ext(original_name)
    allowed_mimes = ALLOWED_FILE_TYPES.get(extension)
    if not allowed_mimes:
        raise UploadError(
            "Unsupported file type. Allowed types: PDF, DOC, DOCX."
        )

    content_type = (file.mimetype or "").lower()
    if content_type and content_type not in allowed_mimes:
        raise UploadError(
            f"File content type '{content_type}' does not match a {extension} file."
        )

    return extension, original_name


def save_reference_file(
    file: FileStorage, patient_id: str, node_id: str
) -> Tuple[str, str, str, int]:
    """
    Persist an uploaded file to disk.

    Returns ``(stored_name, original_name, content_type, size_bytes)``.
    """
    extension, original_name = validate_upload(file)

    target_dir = os.path.join(_upload_root(), str(patient_id), str(node_id))
    os.makedirs(target_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{extension}"
    target_path = os.path.join(target_dir, stored_name)
    file.save(target_path)

    size_bytes = os.path.getsize(target_path)
    if size_bytes > MAX_FILE_BYTES:
        # Defensive: remove and reject if somehow oversized.
        try:
            os.remove(target_path)
        except OSError:
            pass
        raise UploadError("File exceeds the maximum allowed size (10MB).")

    content_type = file.mimetype or DEFAULT_MIME_BY_EXT.get(extension, "")
    return stored_name, original_name, content_type, size_bytes


def reference_file_path(
    patient_id: str, node_id: str, stored_name: str
) -> Optional[str]:
    """
    Resolve the absolute path of a stored reference file, guarding against
    path traversal. Returns ``None`` if the file does not exist or the resolved
    path escapes the upload root.
    """
    if not stored_name:
        return None

    root = os.path.abspath(_upload_root())
    candidate = os.path.abspath(
        os.path.join(root, str(patient_id), str(node_id), stored_name)
    )
    # Ensure the resolved path stays within the upload root.
    if os.path.commonpath([root, candidate]) != root:
        return None
    if not os.path.isfile(candidate):
        return None
    return candidate


def delete_reference_file(
    patient_id: str, node_id: str, stored_name: str
) -> None:
    """Delete a single stored reference file if it exists (best-effort)."""
    path = reference_file_path(patient_id, node_id, stored_name)
    if path:
        try:
            os.remove(path)
        except OSError:
            pass


def delete_patient_upload_dir(patient_id: str) -> None:
    """Remove all uploaded files for a patient tree (best-effort)."""
    root = os.path.abspath(_upload_root())
    candidate = os.path.abspath(os.path.join(root, str(patient_id)))
    # Guard against path traversal before removing the directory tree.
    if os.path.commonpath([root, candidate]) != root or candidate == root:
        return
    if os.path.isdir(candidate):
        shutil.rmtree(candidate, ignore_errors=True)
