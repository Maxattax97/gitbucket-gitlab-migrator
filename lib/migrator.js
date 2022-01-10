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

		this._gitlabUsers = { bot: this._gitlab };

		this._cache = {
			Gitlab: { Users: null },
			Gitbucket: {}
		};
	}

	async _impersonate(opt)
	{
		opt = _.defaultsDeep(opt, {
			User: null,
			ExpiresAt: DateTime.now().plus({ days: 1 })
		});

		if(!this._gitlabUsers[opt.User])
		{
			const user_obj = await this._getGitlabUser({ username: opt.User });
			let user_id;

			if(user_obj)
			{
				user_id = user_obj.id;

				const impersonation_token = await this._gitlab.UserImpersonationTokens.add(user_id, `gitlab bot impersonation token for ${opt.User}`, [
					"api", "read_user"
					//"write_user"
					//"read_api",
					//"read_repository",
					//"write_repository"
				], opt.ExpiresAt.toISO(), {});

				//Logger.debug("Created impersonation token: %o", impersonation_token);

				this._gitlabUsers[opt.User] = new Gitlab({
					token: impersonation_token.token,
					host: process.env.GITLAB_URL
				});
			}
			else
			{
				Logger.warn(`${opt.User} does not exist, using Gitlab bot instead to impersonate`);

				return this._gitlab;
			}
		}

		return this._gitlabUsers[opt.User];
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
				per_page: 100,
				page: page_index
			})).data;

			meta_issues = _.concat(latest_issues, meta_issues);
			page_index++;
		}

		return _.sortBy(meta_issues, "number");
	}

	async GetAllGitbucketMilestones()
	{
		throw new Error("Not implemented");
	}

	async GetAllCommentsForGitbucketIssue(opt)
	{
		opt = _.defaultsDeep(opt, {
			Issue: null,
			Owner: "bats",
			Repo: "meta"
		});

		// NOTE: Gitbucket API is broken for this API endpoint; pagination does not work (all pages return page 1).
		const comments = (await this._gitbucket.issues.listComments({
			owner: opt.Owner,
			repo: opt.Repo,
			issue_number: opt.Issue,
			per_page: 100
		})).data;

		return comments;
	}

	async GetAllGitlabIssues()
	{
		return this._gitlab.Issues.all();
	}

	async CreateGitlabGroupMilestone(opt)
	{
		opt = _.defaultsDeep(opt, {
			As: "bot",
			Group: "bats",
			Title: null,
			Description: null,
			StartDate: DateTime.now(),
			DueDate: null,
			IsClosed: false
		});

		const imp = await this._impersonate({ User: opt.As });

		const created_milestone = await imp.GroupMilestones.create(opt.Group, opt.Title, {
			description: opt.Description,
			start_date: opt.StartDate.toISO(),
			due_date: opt.DueDate ? opt.DueDate.toISO() : undefined
		});
		//Logger.debug("Milestone created: %o", created_milestone);

		if(opt.IsClosed)
		{
			const closed_status = await imp.GroupMilestones.edit(opt.Group, created_milestone.iid, { state_event: "close" });
			//Logger.debug("Milestone closed: %o", closed_status);

			return closed_status;
		}

		return created_milestone;
	}

	async CreateGitlabIssue(opt)
	{
		opt = _.defaultsDeep(opt, {
			As: "bot",
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

		const imp = await this._impersonate({ User: opt.As });

		const assignee_user_obj = await this._getGitlabUser({ username: opt.Assignee });
		let assignee_id;
		//Logger.debug(`${opt.Assignee} produced`, assignee_user_obj);
		if(assignee_user_obj)
		{
			assignee_id = assignee_user_obj.id;
		}

		const created_issue = await imp.Issues.create(opt.Project, {
			title: opt.Title,
			description: opt.Description,
			assignee_id,
			created_at: opt.CreatedTime.toISO(),
			due_date: opt.DueDate ? opt.DueDate.toISO() : undefined, // Must be an ISO 8601 string.
			labels: opt.Labels.join(",") // Must be joined with ","
		});
		//Logger.debug("Issue created: %o", created_issue);

		if(opt.IsClosed)
		{
			const closed_status = await imp.Issues.edit(opt.Project, created_issue.iid, { state_event: "close" });
			//Logger.debug("Issue closed: %o", closed_status);

			return closed_status;
		}

		return created_issue;
	}

	async AddGitlabCommentToIssue(opt)
	{
		opt = _.defaultsDeep(opt, {
			As: "bot",
			Project: null,
			Issue: null,
			Body: null,
			CreatedAt: DateTime.now()
		});

		const imp = await this._impersonate({ User: opt.As });

		return imp.IssueDiscussions.create(opt.Project, opt.Issue, opt.Body, { created_at: opt.CreatedAt.toISO() });
	}
}

module.exports = Migrator;
