import base64
import os
import urllib.request
from typing import Any


def read_payload_bytes(payload: dict[str, Any]) -> tuple[bytes, str]:
    if payload.get("signedUrl"):
        with urllib.request.urlopen(payload["signedUrl"]) as response:
            return response.read(), "signed_url"

    if payload.get("storageKey"):
        return read_object_from_storage(payload["storageKey"]), "storage_key"

    if payload.get("contentBase64"):
        return base64.b64decode(payload["contentBase64"]), "content_base64"

    raise ValueError("Missing signedUrl, storageKey, or contentBase64.")


def read_object_from_storage(key: str) -> bytes:
    try:
        import boto3
    except ModuleNotFoundError as exc:
        raise ValueError("boto3 is required for storageKey reads.") from exc

    bucket = os.getenv("OBJECT_STORAGE_BUCKET")
    region = os.getenv("OBJECT_STORAGE_REGION")
    access_key = os.getenv("OBJECT_STORAGE_ACCESS_KEY_ID")
    secret_key = os.getenv("OBJECT_STORAGE_SECRET_ACCESS_KEY")
    endpoint = os.getenv("OBJECT_STORAGE_ENDPOINT")

    missing = [
        name
        for name, value in {
            "OBJECT_STORAGE_BUCKET": bucket,
            "OBJECT_STORAGE_REGION": region,
            "OBJECT_STORAGE_ACCESS_KEY_ID": access_key,
            "OBJECT_STORAGE_SECRET_ACCESS_KEY": secret_key,
        }.items()
        if not value
    ]
    if missing:
        raise ValueError(f"Object storage is partially configured in sidecar: {', '.join(missing)}")

    client = boto3.client(
        "s3",
        endpoint_url=endpoint or None,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()
