const _ = require("lodash");
const{ Octokit } = require("@octokit/rest");
const{ Gitlab } = require("@gitbeaker/node");
const Logger = require("./logger.js");

class Migrator
{
	constructor(opt)
	{
		this._gitbucket = new Octokit({
			auth: process.env.GITBUCKET_TOKEN,
			// userAgent: `gitbucket-gitlab-migration v${Package.version}`,
			// timeZone: 'America/Indiana/Indianapolis',
			baseUrl: `${process.env.GITBUCKET_URL}/api/v3`,
			headers: { accept: "application/json" }
		});

		this._gitlab = new Gitlab({
			token: process.env.GITLAB_TOKEN,
			host: process.env.GITLAB_URL
		});
	}

	async GetAllGitbucketIssues()
	{
		let latest_issues = null;
		let page_index = 1;
		let meta_issues = [];

		while(null === latest_issues || latest_issues.length > 0)
		{
			latest_issues = (await this._gitbucket.issues.get({
				owner: "bats",
				repo: "meta",
				state: "all",
				page: page_index
			})).data;

			meta_issues = _.concat(latest_issues, meta_issues);
			page_index++;
		}

		return _.sortBy(meta_issues, "number");
	}

	async GetAllGitlabIssues()
	{
		return this._gitlab.Issues.all();
	}
}

module.exports = Migrator;
