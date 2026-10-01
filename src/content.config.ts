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
const seo = z.object({ title: z.string().max(70), description: z.string().max(170) });

const pages = defineCollection({
  loader: glob({ pattern: 'home.json', base: './src/content/pages' }),
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
        roots: z.object({ kicker: z.string(), lead: z.string(), body: z.string(), image: pic }),
        founder: z.object({ kicker: z.string(), lead: z.string(), body: z.string(), image: pic })
      }),
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
        phrases: lines,
        intro: z.string(),
        steps: z
          .array(z.object({ kicker: z.string(), title: z.string(), titleAccent: z.string(), body: z.string(), image: pic }))
          .length(5)
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
              cta: z.string(),
              image: pic
            })
          )
          .length(3)
      }),
      linings: z.object({
        kicker: z.string(),
        phrases: lines,
        body: z.string(),
        image: pic,
        groupsTitle: z.string(),
        groups: z.array(z.object({ title: z.string(), items: z.array(z.string()).min(1) })).min(1)
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

// Inner pages. Giacca and Pantalone share one shape: a hero plus categories of options
// (each rendered by the horizontal-pile catalogue). `image: null` renders the "render to be supplied" placeholder.
const catalogPages = defineCollection({
  loader: glob({ pattern: '{giacca,pantalone}.json', base: './src/content/pages' }),
  schema: ({ image }) => {
    const pic = z.object({ src: image(), alt: z.string() });
    const item = z.object({
      name: z.string(),
      sub: z.string().optional(),
      text: z.string(),
      note: z.string().optional(),
      image: pic.nullable().default(null)
    });
    const category = z.object({
      id: z.string(),
      kicker: z.string().optional(),
      title: lines,
      intro: z.string().optional(),
      groups: z
        .array(z.object({ title: z.string().optional(), items: z.array(item).min(1) }))
        .min(1)
    });
    return z.object({
      seo,
      hero: z.object({
        kicker: z.string(),
        title: lines,
        subtitle: z.string().optional(),
        intro: z.string(),
        extra: z.string().optional(),
        image: pic
      }),
      categories: z.array(category).min(1),
      // Only the jacket page links to the linings section of the home page.
      linings: z.object({ kicker: z.string(), title: z.string(), cta: z.string(), href: z.string() }).optional()
    });
  }
});

const tessutiPage = defineCollection({
  loader: glob({ pattern: 'tessuti.json', base: './src/content/pages' }),
  schema: ({ image }) => {
    const pic = z.object({ src: image(), alt: z.string() });
    return z.object({
      seo,
      hero: z.object({ kicker: z.string(), title: lines, intro: z.string(), image: pic }),
      fibres: z.object({ title: lines, body: z.string(), gallery: z.array(pic).min(1) }),
      renylon: z.object({ title: lines, body: z.array(z.string()).min(1) }),
      partners: z.object({
        title: lines,
        groups: z
          .array(z.object({ title: z.string(), items: z.array(z.object({ name: z.string(), year: z.number().int() })).min(1) }))
          .min(1),
        note: z.string()
      }),
      denim: z.object({
        title: lines,
        body: z.string(),
        images: z.array(pic).min(1),
        featuresTitle: z.string(),
        features: z.array(z.object({ title: z.string(), body: z.string() })).min(1)
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

export const collections = { pages, catalogPages, tessutiPage, settings };
