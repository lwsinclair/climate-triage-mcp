#!/usr/bin/env tsx
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";

// Get API base URL for ClimateTriage
const API_BASE_URL = "https://ost.ecosyste.ms/api/v1";

// Create a new FastMCP server instance
const server = new FastMCP({
  name: "ClimateTriage MCP",
  version: "1.0.0",
});

// Tool for searching climate-related issues
server.addTool({
  name: "search_climate_triage_issues",
  description:
    "Searches for open source issues related to climate change, sustainability and more. " +
    "Use this tool to find opportunities to contribute to projects addressing climate challenges, " +
    "explore issues in specific programming languages, or discover projects in various sustainability categories. " +
    "Returns information about issues including project details, descriptions, and links. " +
    "Supports filtering, pagination, and sorting to help find relevant issues.",
  parameters: z.object({
    category: z
      .enum([
        "Climate Change",
        "Energy Systems",
        "Emissions",
        "Consumption",
        "Biosphere",
        "Hydrosphere",
        "Sustainable Development",
      ])
      .describe("Filter issues by project category")
      .optional(),
    language: z
      .enum([
        "JavaScript",
        "TypeScript",
        "Python",
        "Java",
        "C#",
        "C++",
        "C",
        "Ruby",
        "Go",
        "Rust",
        "Swift",
        "Kotlin",
        "PHP",
        "HTML",
        "CSS",
        "Shell",
        "Dart",
        "Scala",
        "R",
        "Elixir",
        "Clojure",
      ])
      .describe("Filter issues by programming language")
      .optional(),
    keyword: z
      .string()
      .describe(
        "Filter issues by project keyword (e.g., 'bug', 'help wanted', 'enhancement')"
      )
      .optional(),
    page: z
      .number()
      .int()
      .min(1)
      .describe("Pagination page number (starts at 1)")
      .optional(),
    per_page: z
      .number()
      .int()
      .min(1)
      .default(10)
      .describe("Number of records per page (default: 10)")
      .optional(),
    sort: z
      .enum(["created_at", "updated_at", "stars"])
      .default("created_at")
      .describe(
        "Field to sort by (default: created_at). Use created_at for most recent issues first."
      )
      .optional(),
    order: z
      .enum(["asc", "desc"])
      .default("desc")
      .describe(
        "Sort order (asc or desc) (default: desc for most recent first)"
      )
      .optional(),
  }),
  execute: async (args, { log }) => {
    try {
      log.info("Searching for climate issues", {
        category: args.category,
        language: args.language,
        keyword: args.keyword,
        page: args.page,
        per_page: args.per_page,
        sort: args.sort,
        order: args.order,
      });

      const params = new URLSearchParams();

      if (args.category) {
        params.append("category", args.category);
      }

      if (args.language) {
        params.append("language", args.language);
      }

      if (args.keyword) {
        params.append("keyword", args.keyword);
      }

      if (args.page) {
        params.append("page", args.page.toString());
      }

      if (args.per_page !== undefined) {
        params.append("per_page", args.per_page.toString());
      }

      if (args.sort) {
        params.append("sort", args.sort);
      }

      if (args.order) {
        params.append("order", args.order);
      }

      const response = await fetch(
        `${API_BASE_URL}/issues?${params.toString()}`
      );

      if (!response.ok) {
        throw new UserError(
          `Failed to search climate issues: ${response.statusText} (${response.status})`
        );
      }

      const data = await response.json();

      // Transform the data to include only necessary fields
      const transformedData = Array.isArray(data)
        ? data.map((issue) => transformIssue(issue))
        : [];

      log.info("Climate issues search completed", {
        resultsCount: transformedData.length,
      });

      // Get pagination info
      const totalCount =
        parseInt(response.headers.get("X-Total-Count") || "0", 10) ||
        transformedData.length;
      const currentPage = args.page || 1;
      const perPage = args.per_page || 10;
      const totalPages = Math.ceil(totalCount / perPage);

      // Format the results in Markdown for better LLM presentation
      // Update the formatting in your execute method
      const formattedResults = transformedData
        .map((issue, index) => {
          return `
          ISSUE #${index + 1}: "${issue.title}"
          ISSUE LINK: ${issue.url}
          ISSUE CREATED: ${formatDate(issue.created_at)}
          ISSUE STATE: ${issue.state}
          ISSUE LABELS: ${issue.labels.join(", ") || "None"}

          BELONGS TO PROJECT: "${issue.project.name}"
          PROJECT LINK: ${issue.project.repository_url}
          PROJECT LANGUAGE: ${issue.project.language || "Unknown"}
          PROJECT CATEGORY: ${issue.project.category || "Uncategorized"}
          PROJECT STARS: ${issue.project.stars}

          ${issue.body ? `ISSUE DESCRIPTION: ${issue.body}\n` : ""}
          `;
        })
        .join("\n------------------------------\n");

      // Add pagination information
      let paginationInfo = "";
      if (transformedData.length > 0) {
        paginationInfo = `\n\n---\n\nShowing page ${currentPage} of ${totalPages} (${transformedData.length} of ${totalCount} total results)`;

        if (currentPage < totalPages) {
          paginationInfo += `\nUse \`page: ${
            currentPage + 1
          }\` to see more results.`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text:
              transformedData.length > 0
                ? `# Found ${totalCount} Climate Issues\n\n${formattedResults}${paginationInfo}`
                : "No issues found matching your criteria. Try adjusting your search parameters.",
          },
        ],
      };
    } catch (error) {
      if (error instanceof UserError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new UserError(`Error searching climate issues: ${errorMessage}`);
    }
  },
});

// Function to transform the response to include only necessary fields
function transformIssue(issue: any) {
  // Extract labels as strings
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label: any) =>
        typeof label === "string" ? label : label.name || label.toString()
      )
    : [];

  return {
    id: issue.uuid,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user?.login || issue.user?.name || "anonymous",
    labels: labels,
    comments_count: issue.comments_count || 0,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    url: issue.html_url,
    body: issue.body
      ? issue.body.substring(0, 200) + (issue.body.length > 200 ? "..." : "")
      : "",
    project: {
      name: issue.project?.name || "Unknown Project",
      description: issue.project?.description || "",
      language: issue.project?.language || "",
      category: issue.project?.category || "",
      stars: issue.project?.repository?.stargazers_count || 0,
      owner:
        issue.project?.repository?.owner?.login ||
        issue.project?.repository?.owner ||
        "unknown",
      repository_url:
        issue.project?.repository?.html_url || issue.project?.html_url || "",
    },
  };
}

// Helper function to format dates
function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Unknown date";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return dateString;
  }
}

// Start the server with stdio transport
server.start({
  transportType: "stdio",
});
