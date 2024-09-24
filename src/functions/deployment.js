// Helper function to add deployment statuses to a PR / ref
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param ref: The ref to add the deployment status to
// :param state: The state of the deployment
// :param deploymentId: The id of the deployment
// :param environment: The environment of the deployment
// :param environment_url: The environment url of the deployment (default '')
// :returns: The result of the deployment status creation (Object)
export async function createDeploymentStatus(
  octokit,
  context,
  ref,
  state,
  deploymentId,
  environment,
  environment_url = null
) {
  // Get the owner and the repo from the context
  const {owner, repo} = context.repo

  const {data: result} = await octokit.rest.repos.createDeploymentStatus({
    owner: owner,
    repo: repo,
    ref: ref,
    deployment_id: deploymentId,
    state: state,
    log_url: `${process.env.GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${context.runId}`,
    environment: environment,
    environment_url: environment_url
  })

  return result
}

// Helper function to check and see if a given sha is active and deployed to a given environment
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param environment: The environment to check for (ex: production)
// :param sha: The sha to check for (ex: cb2bc0193184e779a5efc05e48acdfd1026f59a7)
// :returns: true if the deployment is active for the given environment at the given commit sha, false otherwise
export async function activeDeployment(octokit, context, environment, sha) {
  const deployment = await latestActiveDeployment(octokit, context, environment)

  // If no deployment was found, return false
  if (deployment === null) {
    return false
  }

  // Otherwise, check to see if the deployment is active and the commit sha matches exactly
  return deployment.state === 'ACTIVE' && deployment.commit.oid === sha
}

// Helper function to get the latest deployment for a given environment
// :param octokit: The octokit client
// :param context: The GitHub Actions event context
// :param environment: The environment to get the latest deployment for (ex: production)
// :returns: The result of the deployment (Object)
// 'nodes' may look like this:
// otherwise, nodes may look like this:
// [
//   {
//       "createdAt": "2024-09-19T20:18:18Z",
//       "environment": "production",
//       "updatedAt": "2024-09-19T20:18:23Z",
//       "id": "DE_kwDOID9x8N5sC6QZ",
//       "payload": "{\\\"type\\\":\\\"branch-deploy\\\", \\\"sha\\\": \\\"315cec138fc9d7dbc8a47c6bba4217d3965ede3b\\\"}",
//       "state": "ACTIVE",
//       "creator": {
//           "login": "github-actions"
//       },
//       "ref": {
//           "name": "main"
//       },
//       "commit": {
//           "oid": "315cec138fc9d7dbc8a47c6bba4217d3965ede3b"
//       }
//   }
// ]
export async function latestActiveDeployment(octokit, context, environment) {
  // Get the owner and the repo from the context
  const {owner, repo} = context.repo

  const query = `
    query ($repo_owner: String!, $repo_name: String!, $environment: String!) {
      repository(owner: $repo_owner, name: $repo_name) {
        deployments(environments: [$environment], first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes {
            createdAt
            environment
            updatedAt
            id
            payload
            state
            ref {
              name
            }
            creator {
              login
            }
            commit {
              oid
            }
          }
        }
      }
    }`

  const variables = {
    repo_owner: owner,
    repo_name: repo,
    environment: environment
  }

  const data = await octokit.graphql(query, variables)
  // nodes may be empty if no matching deployments were found - ex: []
  const nodes = data.repository.deployments.nodes

  // If no deployments were found, return null
  if (nodes.length === 0) {
    return null
  }

  // Otherwise, return the latest deployment
  return nodes[0]
}
