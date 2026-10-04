use npm install for frontend 
use the requirement.txt to follow the steps 
Part 1: Docker Container Creation & Management
1. Building Images
docker build -t <image-name>:<tag> . — Build an image from a Dockerfile in the current directory.

docker build --no-cache -t <image-name>:<tag> . — Force a build without using cached layers.

docker tag <source-image>:<tag> <target-repo>/<image-name>:<tag> — Retag an image before pushing to a remote registry.

docker push <registry-url>/<image-name>:<tag> — Push the built image to Docker Hub or a private registry.

2. Running Containers
docker run -d --name <container-name> -p <host-port>:<container-port> <image-name> — Run a container in detached mode (background) with port forwarding.

docker run -it --rm <image-name> /bin/sh — Run an ephemeral container interactively (auto-removes on exit).

docker run -d --env <KEY>=<VALUE> -v <host-path>:<container-path> <image-name> — Run with environment variables and mounted volume storage.

3. Monitoring & Lifecycle
docker ps — List running containers (-a to include stopped ones).

docker logs -f <container-name> — Follow real-time container output.

docker exec -it <container-name> /bin/bash — Open an interactive shell inside a running container.

docker stop <container-name> — Gracefully halt a running container.

docker rm -f <container-name> — Force-remove a container.

Part 2: Kubernetes Launching & Deployment (kubectl)
1. Cluster Setup & Context
minikube start or kind create cluster — Initialize a local development cluster.

kubectl cluster-info — Verify cluster control plane connectivity.

kubectl config get-contexts — View available cluster configurations.

kubectl config use-context <context-name> — Switch the active cluster context.

2. Declarative Launch (Manifest Files)
kubectl apply -f <manifest.yaml> — Create or update resources (Deployments, Services, ConfigMaps).

kubectl apply -f ./k8s-directory/ — Recursively apply all manifest files within a directory.

kubectl delete -f <manifest.yaml> — Tear down all resources specified in a file.

3. Imperative Launch (Fast Execution)
kubectl run <pod-name> --image=<image-name> — Spin up a standalone Pod.

kubectl create deployment <deploy-name> --image=<image-name> --replicas=3 — Create a managed deployment with 3 replicas.

kubectl expose deployment <deploy-name> --port=<service-port> --target-port=<container-port> --type=LoadBalancer — Expose the deployment to network traffic via a Service.

4. Monitoring & Troubleshooting
kubectl get pods -o wide — Inspect pod status, IPs, and assigned worker nodes.

kubectl get deployments,svc,ingress — View common workloads and networking resources in the current namespace.

kubectl describe pod <pod-name> — View detailed metadata, events, and failure reasons (e.g., ImagePullBackOff).

kubectl logs -f <pod-name> -c <container-name> — Tail container logs inside a pod.

kubectl port-forward svc/<service-name> 8080:<service-port> — Forward local traffic directly to an internal cluster service for debugging.
docker build -t my-mcp-server:1.0 .
docker build --no-cache -t my-mcp-server:latest .
docker run -i --rm -e API_KEY="your-secret-key" my-mcp-server:1.0
{
  "mcpServers": {
    "my-docker-mcp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "API_KEY=your-key", "my-mcp-server:1.0"]
    }
  }
}
docker run -d --name mcp-server -p 8000:8000 -e ENV=production my-mcp-server:1.0
docker logs -f mcp-server
curl -i http://localhost:8000/sse
kubectl create secret generic mcp-api-creds --from-literal=AUTH_TOKEN="your-token"
docker tag my-mcp-server:1.0 <your-registry>/my-mcp-server:1.0
docker push <your-registry>/my-mcp-server:1.0
kubectl apply -f mcp-server.yaml
kubectl run mcp-test --image=<your-registry>/my-mcp-server:1.0 --port=8000 --env="ENV=dev"
kubectl expose deployment mcp-server --port=80 --target-port=8000 --type=ClusterIP
3. Connecting, Testing & MonitoringForward traffic locally to test tool calls directly from your machine or IDE:Bashkubectl port-forward svc/mcp-server 8000:8000
Follow tool execution and request logs in real time:Bashkubectl logs -f -l app=mcp-server --tail=100
Inspect pod crashes or configuration failures:Bashkubectl describe pod -l app=mcp-server
Scale the MCP server for high-concurrency tool execution:Bashkubectl scale deployment mcp-server --replicas=3
Reference: Minimal Kubernetes Manifest (mcp-server.yaml)YAMLapiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  labels:
    app: mcp-server
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp
        image: <your-registry>/my-mcp-server:1.0
        ports:
        - containerPort: 8000
        envFrom:
        - secretRef:
            name: mcp-api-creds
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "100m"
            memory: "128Mi"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-server
spec:
  selector:
    app: mcp-server
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
