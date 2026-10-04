from fastmcp import FastMCP
import os
import random

mcp = FastMCP("oprations_server")

@mcp.tool()
def search_knowledge_base(query: str) ->str:
    db = {
        "cluster": "Production cluster is runs on GKE with auto-scaling enabled",
        "deploy":"Deployments are managed via CI/CD pipelines and Kubernetes",
        "incident": "P1 alerts reqiure onCall engineer page via pageDuty."

    }
    return db.get(query.lower(), "No information available for the given topic.")
@mcp.tool()
def get_system_status() -> str:
    return os.popen("uptime").read().strip()


@mcp.tool()
def get_random_operations_tip() -> str:
    """Return a random Kubernetes and operations best-practice tip."""
    tips = [
        "Keep production workloads behind readiness and liveness probes.",
        "Set CPU and memory requests so Kubernetes can schedule pods reliably.",
        "Use rolling deployments to avoid downtime during application updates.",
        "Keep API keys in Kubernetes Secrets instead of container images.",
        "Check pod events when a workload is Pending, CrashLoopBackOff, or ErrImagePull.",
    ]
    return random.choice(tips)


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=8000)