import { Elysia, error, t } from "elysia";
import swagger from "@elysiajs/swagger";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-typebox'
import { table } from '$lib/db/schema'
import { db, getCommentsWithoutId } from "$lib/db";
import { eq, ilike } from "drizzle-orm";
import { trimSlashEnd } from "$lib/utils/trim-slash-end";
import { generate } from "$lib/utils/random-string-gen";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { rateLimit } from "elysia-rate-limit";
import { cache } from "elysia-cache";
import cors from "@elysiajs/cors";

const _createComment = createInsertSchema(table.comments, {
  author: t.String({ default: 'Anonymous' }),
  content: t.String(),
  type: t.Optional(t.UnionEnum(['DEFAULT', 'MODERATOR', 'WEBMASTER'])),
  additionalInfo: t.Optional(t.Any()),
  createdAt: t.Optional(t.String()),
  siteUrl: t.Optional(t.String())
})

const createComment = t.Omit(
  _createComment,
  ['id', 'type']
)

const _editComment = createUpdateSchema(table.comments, {
  id: t.String(),
  content: t.String()
})

const editComment = t.Omit(
  _editComment,
  ['author', 'additionalInfo', 'createdAt', 'siteUrl', 'type', 'parentId']
)

DOMPurify.setConfig(
  {
    USE_PROFILES: {html: true},
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['style', 'class', 'aria-hidden', 'data-japicmt-replyid']
  }
)

const app = new Elysia({ prefix: '/api' })
  .use(rateLimit({ max: 5 }))
  .use(cache())
  .use(cors())
  .use(swagger({
    path: '/',
    documentation: {
      info: {
        title: 'jAPI Documentation',
        description: 'The documentation of jAPI.',
        version: '1.0.0'
      },
      tags: [
        { name: 'jAPI Comments', description: "The documentation of jAPI's Comments.\n\nVisit https://github.com/japi/comments or https://api.jb.is-a.dev/comments for more information." }
      ]
    }
  }))
  .onError((handler) => {
    if (handler.path.endsWith('create-api-key')) {
      return "NOT_FOUND"
    }
    else
      return handler.error
  })
  .post('/create-api-key', async ({ query }) => {
    const { domain, masterKey } = query

    if (masterKey !== process.env.MASTER_KEY) {
      throw error(404, "NOT_FOUND")
    }

    const apiKey = generate(64);

    const apiData: typeof table.apiKeys.$inferInsert = {
      key: apiKey,
      domain: domain
    }

    await db.insert(table.apiKeys).values(apiData)
    
    return apiKey
  }, {
    query: t.Object({
      domain: t.String(),
      masterKey: t.String()
    }),
    // detail: { 
    //   hide: true
    // } 
  })
  .get('/comments', async ({ query }) => {
    const { url, apiKey } = query;

    if (!url) {
      throw error(400, "url must be defined")
    } else if (!URL.canParse(url)) {
      throw error(400, "url must be a valid URL")
    }

    let api = await db.query.apiKeys.findFirst({ where: (f, o) => o.eq(f.key, apiKey) })
    let comments;
    if (!api) {
      comments = await getCommentsWithoutId(url)
    } else {
      const comm = await db.query.comments.findMany({
          with: {
              replies: true
          },
          where: (fields, operators) => operators.and(operators.isNull(fields.parentId), operators.ilike(fields.siteUrl, `${encodeURIComponent(trimSlashEnd(url))}%`)),
      });
      
      comments = comm.map((comment) => {
        const { id, ...rest } = comment;

        return {
          replyId: String(comment.id).substring(0, 6),
          ...rest,
        }
      })
    }

    return comments
  }, {
    query: t.Object({
      url: t.String(),
      apiKey: t.Optional(t.String())
    }),
    detail: { 
      summary: 'Get all comments', 
      tags: ['jAPI Comments'] 
    } 
  })
  .post('/comments', async ({ body, query, headers }) => {
    const { author, content, siteUrl, parentId, additionalInfo } = body;
    const { parseMarkdown } = query;
    const { origin } = headers;

    let url;
    if (siteUrl && siteUrl !== "")
      url = siteUrl
    else if (origin)
      url = origin
    else
      throw error(400, 'siteUrl must have a value')

    let api = await db.query.apiKeys.findFirst({ where: (f, o) => o.eq(f.key, query.apiKey) })
    let type = "DEFAULT";
    if (api) type = "WEBMASTER"

    let cnt: string = content;

    if (parseMarkdown) {
      cnt = await marked.parse(cnt)
    }

    cnt = DOMPurify.sanitize(cnt)

    let gen = generate(12);
    const comment: typeof table.comments.$inferInsert = {
      id: gen,
      author,
      content: cnt,
      type: type,
      parentId,
      siteUrl: encodeURIComponent(trimSlashEnd(url)),
      additionalInfo
    }

    await db.insert(table.comments).values(comment)
    
    return gen
  }, {
    
    body: createComment,
    headers: t.Object({
      origin: t.Optional(t.String())
    }),
    query: t.Object({
      parseMarkdown: t.Optional(t.Boolean({
        default: false,
        description: 'Whether to parse Markdown. This will still allow formatting by HTML or if you want to format your user\'s comments client-side. If you don\'t want to do that, disable allowHTML on the jAPI Comment Widget configuration script.'
      })),
      apiKey: t.Optional(t.String())
    }),
    detail: { 
      summary: 'Create a comment', 
      tags: ['jAPI Comments'],
      description: 'Creates a comment. Note that for everyone\'s safety, all comments will be purified.'
    } 
  })
  .patch('/comments', async ({ body, query }) => {
    const { id, content } = body
    const { parseMarkdown } = query;

    const comment = await db.query.comments.findFirst({
      where: (f, o) => o.eq(f.id, id)
    })

    if (!comment) {
      throw error(404, "Comment not found")
    }

    let cnt: string = content;

    if (parseMarkdown) {
      cnt = await marked.parse(cnt)
    }

    cnt = DOMPurify.sanitize(cnt)

    await db.update(table.comments).set({ content: cnt }).where(eq(table.comments.id, id))

    return id
  }, {
    body: editComment,
    query: t.Object({
      parseMarkdown: t.Optional(t.Boolean({
        default: false,
        description: 'Whether to parse Markdown. This will still allow formatting by HTML or if you want to format your user\'s comments client-side. If you don\'t want to do that, disable allowHTML on the jAPI Comment Widget configuration script.'
      }))
    }),
    detail: { 
      summary: 'Edit a comment', 
      tags: ['jAPI Comments'] 
    } 
  })
  .delete('/comments', async ({ query }) => {
    const { id } = query

    const comment = await db.query.comments.findFirst({
      where: (f, o) => o.eq(f.id, id)
    })

    if (!comment) {
      throw error(404, "Comment not found")
    }

    await db.delete(table.comments).where(eq(table.comments.id, id))

    return id
  }, {
    query: t.Object({
      id: t.String(),
    }),
    detail: { 
      summary: 'Delete a comment', 
      tags: ['jAPI Comments'] 
    } 
  });

type RequestHandler = (v: { request: Request }) => Response | Promise<Response>

export const GET: RequestHandler = ({ request }) => app.handle(request)
export const POST: RequestHandler = ({ request }) => app.handle(request)