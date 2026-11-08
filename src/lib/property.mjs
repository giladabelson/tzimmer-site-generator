// One resolver for every page of a property site. scripts/run.mjs sets
// PROPERTY_SLUG; with none set, the first property found is built.
import { getCollection } from 'astro:content';

export async function loadProperty() {
  const slug = process.env.PROPERTY_SLUG;
  const all = await getCollection('properties');
  const entry = (slug && all.find((e) => e.id === slug)) || all[0];

  if (!entry) {
    throw new Error('לא נמצא אף צימר תחת properties/. הריצו npm run new-property -- --slug=<slug>');
  }
  if (slug && entry.id !== slug) {
    throw new Error(`הצימר "${slug}" לא נמצא. קיימים: ${all.map((e) => e.id).join(', ')}`);
  }

  // scripts/run.mjs derives an accent from the hero image when the content file has none.
  const accent = entry.data.accent ?? process.env.PROPERTY_ACCENT ?? '#6b7f4f';
  return { entry, accent };
}
