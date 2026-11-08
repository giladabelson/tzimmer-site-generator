import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * IMAGE HONESTY
 * Every image declares where it came from:
 *   real        – an actual photograph of this property. The only kind allowed to
 *                 stand in for a room, a view or the grounds without a badge.
 *   placeholder – abstract/generic stand-in. Always rendered with the visible
 *                 Hebrew badge "תמונת המחשה - טרם צולם".
 *   stock       – licensed stock or generated imagery. Allowed for atmosphere and
 *                 textures ONLY. scripts/check-images.mjs fails the build if a
 *                 stock image is used as hero, gallery or panorama.
 */
const SOURCE = ['real', 'placeholder', 'stock'] as const;

export const collections = {
  properties: defineCollection({
    loader: glob({
      base: './properties',
      pattern: ['*/property.md', '!_*/property.md'],
      generateId: ({ entry }) => entry.split('/')[0],
    }),
    schema: ({ image }) =>
      z.object({
        name: z.string(),
        region: z.string(),
        tagline: z.string(),
        shortDescription: z.string(),

        capacity: z.object({
          guests: z.number().int().positive(),
          bedrooms: z.number().int().positive(),
          bathrooms: z.number().positive().default(1),
          beds: z.string().optional(),
        }),

        // "why here" – 2 to 5 short, concrete reasons. Rendered as the scannable block.
        highlights: z.array(z.object({ title: z.string(), body: z.string() })).min(2).max(5),

        amenities: z.array(
          z.object({
            label: z.string(),
            icon: z.string().default('dot'),
            note: z.string().optional(),
          }),
        ),

        price: z.object({
          min: z.number().positive(),
          max: z.number().positive(),
          currency: z.string().default('₪'),
          basis: z.string().default('ללילה, לזוג'),
          note: z.string().optional(),
        }),

        houseRules: z.array(z.string()),
        checkIn: z.string(),
        checkOut: z.string(),

        contact: z.object({
          whatsapp: z.string().regex(/^\+?\d{9,15}$/, 'מספר ואטסאפ חייב להיות ספרות בלבד, למשל +972501234567'),
          phone: z.string().optional(),
          email: z.string().email().optional(),
          ownerName: z.string().optional(),
        }),

        location: z.object({
          lat: z.number(),
          lng: z.number(),
          address: z.string(),
          nearby: z.array(z.object({ name: z.string(), minutes: z.number().int() })).default([]),
        }),

        // Optional. When absent the build derives one from the hero image (scripts/run.mjs).
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),

        images: z.array(
          z.object({
            file: image(),
            alt: z.string(),
            source: z.enum(SOURCE),
            role: z.enum(['hero', 'gallery', 'texture']).default('gallery'),
            caption: z.string().optional(),
          }),
        ).min(1),

        // Optional "walking in" scene: one photo the page pushes into as you
        // scroll, before the photo tour. Works with a placeholder today and a
        // real doorway shot after the shoot.
        entrance: z.object({
          file: image(),
          alt: z.string(),
          source: z.enum(SOURCE),
          caption: z.string().default('נכנסים פנימה'),
        }).optional(),

        panoramas: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            file: image(),
            source: z.enum(SOURCE),
            hfov: z.number().default(100),
            pitch: z.number().default(0),
            yaw: z.number().default(0),
            hotspots: z.array(
              z.object({ pitch: z.number(), yaw: z.number(), target: z.string(), text: z.string() }),
            ).default([]),
          }),
        ).default([]),

        // Gaussian splat fallback, used only when there are no panoramas.
        splatUrl: z.string().url().optional(),

        icalFeeds: z.array(z.string().url()).default([]),

        seo: z.object({ description: z.string().optional() }).default({}),
      }),
  }),
};
