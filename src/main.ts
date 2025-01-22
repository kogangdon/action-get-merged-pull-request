import github from '@actions/github';
import core from '@actions/core';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

interface PullRequest {
  title: string;
  body: string;
  number: number;
  labels: string[] | null;
  assignees: string[] | null;
}

async function run(): Promise<void> {
  try {
    const pull = await getMergedPullRequest(
      core.getInput('github_token'),
      github.context.repo.owner,
      github.context.repo.repo,
      github.context.sha
    );
    if (!pull) {
      core.debug('pull request not found');
      return;
    }

    core.setOutput('title', pull.title);
    core.setOutput('body', pull.body);
    core.setOutput('number', pull.number);
    core.setOutput('labels', pull.labels?.join('\n'));
    core.setOutput('assignees', pull.assignees?.join('\n'));
  } catch (e: any) {
    core.error(e);
    core.setFailed(e.message);
  }
}

async function getMergedPullRequest(
  githubToken: string,
  owner: string,
  repo: string,
  sha: string
): Promise<PullRequest | null> {
  const octokit = github.getOctokit(githubToken);

  type PullsListResponseData = GetResponseDataTypeFromEndpointMethod<
    typeof octokit.rest.pulls.list
  >;
  type PullsListResponseDataItem = PullsListResponseData[number];
  type Label = GetResponseDataTypeFromEndpointMethod<
    typeof octokit.rest.pulls.get
  >['labels'][0];
  type Assignee = NonNullable<
    GetResponseDataTypeFromEndpointMethod<
      typeof octokit.rest.pulls.get
    >['assignees']
  >[number];

  const resp = (await octokit.rest.pulls.list({
    owner,
    repo,
    sort: 'updated',
    direction: 'desc',
    state: 'closed',
    per_page: 100
  })) as { data: PullsListResponseData };

  const pull = resp.data.find(
    (p: PullsListResponseDataItem) => p.merge_commit_sha === sha
  );
  if (!pull) {
    return null;
  }

  const assignees = pull.assignees || [];
  return {
    title: pull.title,
    body: pull.body ?? '',
    number: pull.number,
    labels: pull.labels.map((l: Label) => l.name),
    assignees: assignees.map((a: Assignee) => a.login)
  };
}

run();
