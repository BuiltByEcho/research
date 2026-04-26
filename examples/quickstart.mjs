import { researchPipeline, toResearchReport } from '@builtbyecho/research';

const topic = process.argv.slice(2).join(' ') || 'Playwright MCP browser automation best practices';

const result = await researchPipeline(topic, {
  expand: true,
  count: 5,
  chunk: false,
});

console.log(toResearchReport(result, { title: topic }));
