#!/usr/bin/env node

const _ = require("lodash");
const{ DateTime } = require("luxon");
const Migrator = require("./lib/migrator.js");
const Logger = require("./lib/logger.js");
const Package = require("./package.json");

if(!process.env.GITBUCKET_TOKEN)
{
	throw new Error("Must supply GITBUCKET_TOKEN in environment variable");
}
if(!process.env.GITLAB_TOKEN)
{
	throw new Error("Must supply GITLAB_TOKEN in environment variable");
}
if(!process.env.GITBUCKET_URL)
{
	throw new Error("Must supply GITBUCKET_URL in environment variable");
}
if(!process.env.GITLAB_URL)
{
	throw new Error("Must supply GITLAB_URL in environment variable");
}

(async () =>
{
	const migrator = new Migrator();

	Logger.info("Gathering issues from Gitbucket ...");
	const gitbucket_issues = await migrator.GetAllGitbucketIssues();
	//Logger.debug("Gitbucket issues: %o", gitbucket_issues);

	Logger.info(`Discovered ${gitbucket_issues.length} Gitbucket issues`);

	const fix_gitbucket_links = function(str)
	{
		const url = "https://gitbucket.portal.batswireless.com/bats/meta/issues";
		const replacements = {}; // "#1": `${url}/1` };
		const regex = /#([0-9]+)/gm;
		let m;

		while((m = regex.exec(str)) !== null)
		{
			// This is necessary to avoid infinite loops with zero-width matches
			if(m.index === regex.lastIndex)
			{
				regex.lastIndex++;
			}

			// The result can be accessed through the `m`-variable.
			m.forEach((match, groupIndex) =>
			{
				if(1 === groupIndex)
				{
					replacements[`#${match}`] = `${url}/${match}`;
				}
			});
		}

		_.each(replacements, (url, tag) =>
		{
			str = str.replaceAll(tag, `[${tag}](${url})`);
		});

		const url_replacements = {
			"git.portal.batswireless.com": "gitbucket.portal.batswireless.com",
			"10.2.0.152:5000": "gitbucket.portal.batswireless.com"
		};

		_.each(url_replacements, (good, bad) =>
		{
			str = str.replaceAll(bad, good);
		});

		return str;
	};

	for(let i = 0; i < gitbucket_issues.length; i++)
	{
		// Good test: 635, 427, 80, 479, 17
		const current_issue = gitbucket_issues[i];
		try
		{
			//Logger.debug("Selected issue: %o", current_issue);

			const gitbucket_issue_comments = await migrator.GetAllCommentsForGitbucketIssue({ Issue: current_issue.number });
			//Logger.debug("Selected issue comments: %o", gitbucket_issue_comments);

			Logger.info(`Migrating issue #${current_issue.number} with ${gitbucket_issue_comments.length} comments ("${current_issue.title}") ...`);
			const labels = [];

			for(let l = 0; l < current_issue.labels.length; l++)
			{
				if(current_issue.labels[l].name.indexOf("@") < 0)
				{
					// Is not a Kanban label
					labels.push(current_issue.labels[l].name);
				}
			}

			const created_issue = await migrator.CreateGitlabIssue({
				As: current_issue.user.login,
				Project: "bats/meta",
				Title: `${current_issue.title} (GB #${current_issue.number})`,
				Description: fix_gitbucket_links(current_issue.body), // The first comment is the description.
				Assignee: current_issue.assignee ? current_issue.assignee.login : undefined,
				CreatedTime: DateTime.fromISO(current_issue.created_at),
				Labels: labels,
				//Milestone: "production",
				IsClosed: "closed" === current_issue.state
			});

			for(let j = 0; j < gitbucket_issue_comments.length; j++)
			{
				const current_comment = gitbucket_issue_comments[j];
				await migrator.AddGitlabCommentToIssue({
					As: current_comment.user.login,
					Project: created_issue.project_id,
					Issue: created_issue.iid,
					Body: fix_gitbucket_links(current_comment.body),
					CreatedAt: DateTime.fromISO(current_comment.created_at)
				});
			}
		}
		catch(err)
		{
			Logger.error(`Failed to migrate issue #${current_issue.number}: %o`, err);
			Logger.warn(`Skipping ${current_issue.number} ...`);
		}
	}
})();
