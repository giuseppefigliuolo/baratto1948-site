/**
 * Content model. Everything editable (texts + images) lives in src/content/*.json
 * and is validated here at build time, so a bad CMS edit fails the build instead
 * of shipping a broken page. Decap CMS (public/admin/config.yml) mirrors this shape.
 *
 * Text conventions (see src/lib/rich.ts):
 *   *parola*  -> italic accent (<em>)
 *   newline   -> line break
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const lines = z.array(z.string().min(1)).min(1);

const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/pages' }),
  schema: ({ image }) => {
    const pic = z.object({ src: image(), alt: z.string() });
    return z.object({
      seo: z.object({
        title: z.string().max(70),
        description: z.string().max(170),
        ogImage: image()
      }),
      hero: z.object({
        kicker: z.string(),
        title: lines,
        tagline: z.string(),
        image: pic
      }),
      manifesto: z.object({
        phrases: lines,
        body: z.string(),
        bodyAccent: z.string(),
        decor: z.array(image()).length(3)
      }),
      heritage: z.object({
        title: lines,
        roots: z.object({ kicker: z.string(), lead: z.string(), body: z.string(), image: pic }),
        founder: z.object({ kicker: z.string(), lead: z.string(), body: z.string(), image: pic })
      }),
      today: z.object({ phrases: lines }),
      quote: z.object({
        sideLeft: z.string(),
        sideRight: z.string(),
        text: z.string(),
        author: z.string(),
        image: pic
      }),
      process: z.object({
        kicker: z.string(),
        title: lines,
        intro: z.string(),
        steps: z
          .array(z.object({ title: z.string(), titleAccent: z.string(), body: z.string(), image: pic }))
          .length(4)
      }),
      details: z.object({
        title: lines,
        body: z.string(),
        image: pic,
        video: z.object({ src: z.string() }),
        // row × side (left, right) of the title split around the video
        split: z.array(z.tuple([z.string(), z.string()])).length(2)
      }),
      collection: z.object({
        kicker: z.string(),
        chapters: z
          .array(
            z.object({
              id: z.enum(['giacca', 'pantalone', 'tessuti']),
              kicker: z.string(),
              title: z.string(),
              titleAccent: z.string(),
              body: z.string(),
              extra: z.string(),
              image: pic
            })
          )
          .length(3)
      }),
      atelier: z.object({
        title: lines,
        hint: z.string(),
        gallery: z.array(pic).min(3)
      }),
      marquee: z.object({ a: z.string(), b: z.string() }),
      contact: z.object({
        title: lines,
        location: z.string(),
        background: image(),
        footerTagline: z.string()
      })
    });
  }
});

const settings = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/settings' }),
  schema: z.object({
    brand: z.string(),
    legalName: z.string(),
    tagline: z.string(),
    foundingYear: z.number().int(),
    founder: z.string(),
    phone: z.string(),
    phoneDisplay: z.string(),
    email: z.email(),
    website: z.url(),
    instagram: z.url(),
    instagramHandle: z.string(),
    address: z.object({
      street: z.string().optional().default(''),
      locality: z.string(),
      postalCode: z.string(),
      province: z.string(),
      region: z.string(),
      country: z.string().length(2)
    }),
    geo: z.object({ lat: z.number(), lng: z.number() }).optional(),
    vatNumber: z.string().optional().default(''),
    intro: z.object({ enabled: z.boolean(), label: z.string(), word: z.string() })
  })
});

export const collections = { pages, settings };
