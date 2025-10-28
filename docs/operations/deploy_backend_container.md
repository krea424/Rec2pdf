# Backend Container Deployment Checklist

The Rec2PDF backend must be built for the `linux/amd64` architecture before being deployed to Cloud Run. Follow the checklist below whenever you cut a new backend release image.

1. **Build the image with Docker Buildx**
   ```bash
   docker buildx build \
     --platform linux/amd64 \
     -f rec2pdf-backend/Dockerfile \
     -t europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:v6.0.1 \
     .
   ```
  WhisperX pulls very large CUDA wheels; if your build machine has a slow connection, set a higher pip timeout (the Dockerfile
  now defaults to `PIP_DEFAULT_TIMEOUT=1000`) or export `PIP_DEFAULT_TIMEOUT=1000` before running the build to avoid
  `ReadTimeoutError` failures. The Dockerfile also sets `PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu` so that PyTorch
  and torchaudio install CPU-only wheels, avoiding multi-hundred-megabyte NVIDIA runtime downloads that frequently time out or
  fail hash verification during `pip install`.
   *Alternative:*
   ```bash
   gcloud builds submit \
     --tag europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:v6.0.1 \
     --region=europe-west3 \
     --config=cloudbuild.yaml # optional, Dockerfile used by default
   ```
   Cloud Build produces `linux/amd64` images by default, so no extra flags are required when using `gcloud builds submit`.

2. **Push the image to Artifact Registry**
   ```bash
   docker push europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:v6.0.1
   docker tag europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:v6.0.1 \
     europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:latest
   docker push europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:latest
   ```
   Update the `latest` tag only if production workflows still reference it.

3. **Redeploy Cloud Run**
   ```bash
   gcloud run deploy rec2pdf-backend \
     --image europe-west3-docker.pkg.dev/rec2pdf/rec2pdf-repo/backend:v6.0.1 \
     --region=europe-west3 \
     --platform=managed \
     --allow-unauthenticated # if the service exposes public endpoints
   ```
   Adjust the service name and flags (`--service-account`, `--max-instances`, etc.) to match the environment.

4. **Verify the new revision**
   - Inspect logs in Cloud Run:
     ```bash
     gcloud logs read \"projects/$(gcloud config get-value project)/logs/run.googleapis.com%2Fstdout\" \
       --limit=100 \
       --format=json | jq '.[].textPayload'
     ```
   - Confirm that no `exec format error` entries appear.
   - Call the health endpoint:
     ```bash
     curl https://<service-url>/api/health
     ```
     A `200 OK` response confirms that the container starts correctly and serves requests.

## Notes
- Keep the version tag in sync with `CHANGELOG.md` and deployment manifests.
- Update any CI/CD automation to build and push the new tag.
- Rotate credentials if the Artifact Registry repository or Cloud Run service is moved to another project.
- If multi-architecture support is required in the future, extend the Buildx command with `--platform linux/amd64,linux/arm64` and verify compatibility of native dependencies before publishing.
