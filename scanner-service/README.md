# Private ClamAV scanner service

This isolated service implements the application contract without exposing uploaded bytes in logs or permanent storage. It accepts only `POST /scan` with `Content-Type: application/octet-stream`, a matching `Authorization: Bearer $SCANNER_TOKEN`, and a declared body no larger than 10 MiB. It returns `{"verdict":"clean"}` only for ClamAV's `stream: OK`, and `{"verdict":"infected"}` only for a confirmed `FOUND` response. All other conditions return `503`.

`GET /healthz` reports process availability. `GET /readyz` requires the token to be configured and confirms that the ClamAV daemon answers `PING`; it is not a scan and must not be used to mark documents clean. The deployment must put this service behind HTTPS and private network controls. Keep `SCANNER_TOKEN` in the service secret store and set the identical value as the application's server-only `MALWARE_SCANNER_TOKEN`.

Build and run locally only after Docker is available:

```text
docker build -t enrollaa-clamav scanner-service
docker run --rm -p 8080:8080 -e SCANNER_TOKEN=replace-with-a-secret enrollaa-clamav
```

The entrypoint downloads definitions with `freshclam`, starts `clamd`, and the `/readyz` check requires a live daemon `PING`. Do not use real onboarding documents in tests. The EICAR test signature is the only intended infected test fixture.

## Render preparation (not deployed by this repository)

`render.yaml` is a minimal Blueprint for a separate Docker web service. It does not contain a token or select a paid plan. Review Render's current plan limits before creation: this service should have at least 2 GiB RAM and 1 dedicated CPU as a starting point because the observed database contained 3.6 million signatures and required roughly two minutes to load after definitions were downloaded. A smaller instance may fail or restart during `clamd` initialization; verify with the actual service logs rather than assuming free-tier suitability. Persistent disk is not required for uploaded files, but a disk or image-cache strategy may reduce repeated definition downloads if supported by the chosen plan; do not treat cached definitions as a substitute for `freshclam` verification.

Manual setup:

1. In Render, create a new private Docker Web Service from this repository and set the root directory to `scanner-service`, or use this directory's Blueprint. Do not expose the service until HTTPS is active and private access controls are reviewed.
2. Let Render generate `SCANNER_TOKEN`, or create a strong random value in Render's secret environment-variable UI. Never put it in `render.yaml`, source, shell history, or logs.
3. Confirm the service health check is `/readyz`. A 200 means the configured token exists and `clamd` answers `PING`; it does not itself scan a file.
4. Copy the service's HTTPS URL into the application host as `MALWARE_SCANNER_URL` with the `/scan` path. Set the identical token value as the application's server-only `MALWARE_SCANNER_TOKEN`. Configure neither value as a browser/public variable.
5. Before enabling real applicant documents, send a synthetic clean file and the EICAR test signature with `Authorization: Bearer <token>` and `Content-Type: application/octet-stream`. Require HTTP 200 with `clean` for the clean file and HTTP 200 with `infected` for EICAR; also verify wrong-token 401, oversized 413, and unavailable readiness behavior. Delete all test material afterward.

The application remains fail-closed while `MALWARE_SCANNER_URL` or `MALWARE_SCANNER_TOKEN` is missing, unreachable, non-HTTPS in production, or returns anything other than an authenticated JSON verdict.
