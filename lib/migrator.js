const _ = require("lodash");
const{ Octokit } = require("@octokit/rest");
const{ Gitlab } = require("@gitbeaker/node");
const{ DateTime } = require("luxon");
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

		this._cache = {
			Gitlab: { Users: null },
			Gitbucket: {}
		};
	}

	async _getGitlabUser(filter)
	{
		// filter = { username: "mocull" }
		// filter = { email: "mocull@batswireless.com" }
		// filter = { id: 3 }

		if(!this._cache.Gitlab.Users)
		{
			await this.GetGitlabUsers();
		}

		return _.find(this._cache.Gitlab.Users, filter);
	}

	async GetGitlabUsers()
	{
		this._cache.Gitlab.Users = await this._gitlab.Users.all();
		return this._cache.Gitlab.Users;
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

	async CreateGitlabGroupMilestone(opt)
	{
		opt = _.defaultsDeep(opt, {
			Group: "bats",
			Title: null,
			Description: null,
			StartDate: DateTime.now(),
			DueDate: null,
			IsClosed: false
		});

		const created_milestone = await this._gitlab.GroupMilestones.create(opt.Group, opt.Title, {
			description: opt.Description,
			start_date: opt.StartDate.toISO(),
			due_date: opt.DueDate ? opt.DueDate.toISO() : undefined
		});
		Logger.debug("Milestone created: %o", created_milestone);

		if(opt.IsClosed)
		{
			const closed_status = await this._gitlab.GroupMilestones.edit(opt.Project, created_milestone.id, { state_event: "closed" });
			Logger.debug("Milestone closed: %o", closed_status);
		}
	}

	async CreateGitlabIssue(opt)
	{
		opt = _.defaultsDeep(opt, {
			Project: null,
			Title: null,
			Description: null,
			Assignee: null, // Takes a username string.
			CreatedTime: DateTime.now(),
			DueDate: null,
			Labels: [],
			Milestone: null,
			IsClosed: false
		});

		const created_issue = await this._gitlab.Issues.create(opt.Project, {
			title: opt.Title,
			description: opt.Description,
			assignee: await this._getGitlabUser({ username: opt.Assignee }),
			created_at: opt.CreatedTime.toISO(),
			due_date: opt.DueDate ? opt.DueDate.toISO() : undefined, // Must be an ISO 8601 string.
			labels: opt.Labels.join(",") // Must be joined with ","
		});
		Logger.debug("Issue created: %o", created_issue);

		if(opt.IsClosed)
		{
			const closed_status = await this._gitlab.Issues.edit(opt.Project, created_issue.id, { state_event: "closed" });
			Logger.debug("Issue closed: %o", closed_status);
		}
	}

	async AddGitlabCommentToIssue(opt)
	{
		opt = _.defaultsDeep(opt, {
			Project: null,
			Issue: null,
			Body: null
		});

		return this._gitlab.IssueDiscussions.create(opt.Project, opt.Issue, opt.Body);
	}
}

module.exports = Migrator;
