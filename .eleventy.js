const path = require("path");
const inspect = require("util").inspect;

const { DateTime } = require("luxon");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItAttrs = require("markdown-it-attrs");
const markdownItRenderer = require("markdown-it")("commonmark");

const schema = require("@quasibit/eleventy-plugin-schema"); // https://www.maxivanov.io/add-structured-data-to-eleventy-blog/

const { execSync } = require("child_process"); // search https://rknight.me/using-pagefind-with-eleventy-for-search/

const striptags = require("striptags"); // @see https://dev.to/jonoyeong/excerpts-with-eleventy-4od8

// official plugins
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginBundle = require("@11ty/eleventy-plugin-bundle");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation"); // https://www.11ty.dev/docs/plugins/navigation/
const { EleventyRenderPlugin } = require("@11ty/eleventy");
const Image = require("@11ty/eleventy-img"); // https://www.11ty.dev/docs/plugins/image/

// method to generate an excerpt
function extractExcerpt(article) {
	if (!article.hasOwnProperty("templateContent")) {
		console.warn(
			'Failed to extract excerpt: Document has no property "templateContent".'
		);
		return null;
	}

	let excerpt = null;
	// console.warn(article.data.description);
	// const content = article.templateContent;
	const content = article.data.description;

	excerpt = striptags(content)
		.substring(0, 200) // Cap at 200 characters
		.replace(/^\\s+|\\s+$|\\s+(?=\\s)/g, "")
		.trim()
		.concat("...");
	return excerpt;
}

module.exports = (eleventyConfig) => {
	// Copy the "assets" directory to the compiled "_site" folder.
	eleventyConfig.addPassthroughCopy("assets");
	eleventyConfig.addPassthroughCopy("CNAME");

	eleventyConfig.addPlugin(eleventyNavigationPlugin);
	eleventyConfig.addPlugin(EleventyRenderPlugin);
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(schema);

	// Official plugins
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginBundle);

	// watch CSS files for changes
	eleventyConfig.setBrowserSyncConfig({
		files: "./_css/**/*.css",
	});

	// Collection overrides
	eleventyConfig.addCollection("report", function (collection) {
		return collection.getAllSorted().reverse();
	});

	// Search https://rknight.me/using-pagefind-with-eleventy-for-search/
	eleventyConfig.on("eleventy.after", () => {
		execSync(`npx pagefind --site \"docs\"`, { encoding: "utf-8" });
	});

	// Get the first `n` elements of a collection.
	eleventyConfig.addFilter("head", (array, n) => {
		if (!Array.isArray(array) || array.length === 0) {
			return [];
		}
		if (n < 0) {
			return array.slice(n);
		}

		return array.slice(0, n);
	});

	// Filters
	eleventyConfig.addFilter(
		"debug",
		(content) => `<pre>${inspect(content)}</pre>`
	);

	eleventyConfig.addFilter("excerpt", (post) => {
		const content = post.replace(/(<([^>]+)>)/gi, "");
		return content.substr(0, content.lastIndexOf(" ", 200)) + "...";
	});

	// @see https://stevenwoodson.com/blog/a-step-by-step-guide-to-sorting-eleventy-global-data-files-by-date/
	eleventyConfig.addFilter("sortYoutubeByDate", (obj) => {
		const sorted = [...obj]; // create a shallow copy of the array

		sorted.sort((item1, item2) => {
			//https://stevenwoodson.com/blog/a-step-by-step-guide-to-sorting-eleventy-global-data-files-by-date/
			return item1.snippet.publishedAt < item2.snippet.publishedAt ? 1 : -1; // most recent first
			// const date1 = new Date(item1.snippet.publishedAt);
			// const date2 = new Date(item2.snippet.publishedAt);
			// if (date1 > date2) return -1;
			// if (date1 < date2) return 1;
			// return 0;
		});
		return sorted;
	});

	eleventyConfig.addFilter("sortZenodoDate", (obj) => {
		const sorted = [...obj];
		sorted.sort((item1, item2) => {
			return item1.metadata.publication_date < item2.metadata.publication_date
				? 1
				: -1;
		});

		return sorted;
	});

	// @see https://www.11ty.dev/docs/plugins/rss/#use-with-other-template-languages
	eleventyConfig.addNunjucksFilter("absoluteUrl", pluginRss.absoluteUrl);
	eleventyConfig.addNunjucksFilter("dateToRfc3339", pluginRss.dateToRfc3339);
	eleventyConfig.addNunjucksFilter("dateToRfc822", pluginRss.dateToRfc822);

	eleventyConfig.addFilter("readableIsoDateDay", (dateObj, format, zone) => {
		return DateTime.fromISO(dateObj, { zone: zone || "utc" }).toFormat(
			format || "LLL d, yyyy"
		);
	});

	eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
		// Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
		return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
			format || "LLL yyyy"
		);
	});

	eleventyConfig.addFilter("readableDateDay", (dateObj, format, zone) => {
		// Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
		return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(
			format || "LLL d, yyyy"
		);
	});

	eleventyConfig.addFilter("htmlDateString", (dateObj) => {
		// dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
		return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
	});

	// Get the first `n` elements of a collection.
	eleventyConfig.addFilter("head", (array, n) => {
		if (!Array.isArray(array) || array.length === 0) {
			return [];
		}
		if (n < 0) {
			return array.slice(n);
		}

		return array.slice(0, n);
	});

	// Customize Markdown library settings:
	eleventyConfig.amendLibrary("md", (mdLib) => {
		mdLib.use(markdownItAttrs);

		mdLib.use(markdownItAnchor, {
			permalink: markdownItAnchor.permalink.ariaHidden({
				placement: "after",
				class: "header-anchor",
				assistiveText: (title) => `Permalink to "${title}`,
				// symbol:' §',
				symbol:
					'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-link-45deg" viewBox="0 0 16 16">\r\n  <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>\r\n  <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>\r\n</svg>',
				// symbol: "\uF470", // need to load bootstrap icons in js
			}),
			level: [1, 2, 3, 4],
			slugify: eleventyConfig.getFilter("slugify"),
		});
	});

	// https://github.com/11ty/eleventy/issues/543#issuecomment-1005914243
	eleventyConfig.addFilter("markdownify", (str) => {
		return markdownItRenderer.render(str);
	});

	// shortcodes
	//https://dev.to/jonoyeong/excerpts-with-eleventy-4od8
	eleventyConfig.addShortcode("excerpt", (article) => extractExcerpt(article));

	// https://www.11ty.dev/docs/plugins/image/
	eleventyConfig.addShortcode("image", async function (src, alt, sizes, css) {
		let metadata = await Image(src, {
			widths: [200, 300, 400, 600],
			formats: ["avif", "jpeg", null],
			outputDir: path.join(eleventyConfig.dir.output, "assets", "images"),
			urlPath: "/dhc2022-forum/assets/images/",
		});

		let imageAttributes = {
			alt,
			sizes,
			class: css,
			loading: "lazy",
			decoding: "async",
		};

		// You bet we throw an error on a missing alt (alt="" works okay)
		return Image.generateHTML(metadata, imageAttributes);
	});

	return {
		dir: {
			input: "./",
			output: "./docs",
			layouts: "./_layouts",
			data: "./_data",
			includes: "./_includes",
		},
		templateFormats: ["md", "njk", "html", "liquid"],

		// Pre-process *.md files with: (default: `liquid`)
		markdownTemplateEngine: "njk",

		pathPrefix: "/dhc2022-forum/", // omit this line if using custom domain
	};
};
