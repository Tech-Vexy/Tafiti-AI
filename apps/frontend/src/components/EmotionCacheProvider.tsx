'use client';

/**
 * Emotion SSR cache provider for the Next.js App Router (official MUI pattern).
 *
 * MUI/Emotion server-renders <style data-emotion> tags as it goes. In the App
 * Router those tags must be flushed through React's own insertion mechanism,
 * otherwise the server HTML contains raw <style> tags where the client render
 * expects a Suspense boundary — which surfaces as the classic
 * "server rendered HTML didn't match the client" hydration error
 * (the diff showed: `+ <Suspense>` vs `- <style data-emotion="css-global ...">`).
 *
 * This mirrors https://mui.com/material-ui/integrations/app-router/ :
 * `cache.compat = true` stops Emotion from emitting <style> tags during SSR,
 * and useServerInsertedHTML flushes whatever was inserted on the server.
 */

import React from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider as DefaultCacheProvider } from '@emotion/react';
import type { Options as OptionsOfCreateCache } from '@emotion/cache';
import createCache from '@emotion/cache';

type InsertedEntry = { name: string; isGlobal: boolean };

export default function EmotionCacheProvider(props: {
  options: Omit<OptionsOfCreateCache, 'insertionPoint'>;
  CacheProvider?: typeof DefaultCacheProvider;
  children: React.ReactNode;
}) {
  const { options, CacheProvider = DefaultCacheProvider, children } = props;

  const [registry] = React.useState(() => {
    const cache = createCache(options);
    cache.compat = true;

    // Track every style inserted during a server render so it can be
    // flushed in one batch through useServerInsertedHTML.
    let inserted: InsertedEntry[] = [];
    const prevInsert = cache.insert;
    cache.insert = (...args: Parameters<typeof prevInsert>) => {
      const [selector, serialized] = args;
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push({ name: serialized.name, isGlobal: !selector });
      }
      return prevInsert(...args);
    };

    const flush = (): InsertedEntry[] => {
      const prevInserted = inserted;
      inserted = [];
      return prevInserted;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const inserted = registry.flush();
    if (inserted.length === 0) {
      return null;
    }

    let styles = '';
    let dataEmotionAttribute = registry.cache.key;
    const globals: { name: string; style: unknown }[] = [];

    inserted.forEach(({ name, isGlobal }) => {
      const style = registry.cache.inserted[name];
      if (typeof style !== 'undefined') {
        styles += style;
        dataEmotionAttribute += ` ${name}`;
        if (isGlobal) {
          globals.push({ name, style });
        }
      }
    });

    return (
      <React.Fragment>
        {globals.map(({ name, style }) => (
          <style
            key={name}
            data-emotion={`${registry.cache.key} ${name}`}
            dangerouslySetInnerHTML={{ __html: style as string }}
          />
        ))}
        {styles !== '' && (
          <style
            data-emotion={dataEmotionAttribute}
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        )}
      </React.Fragment>
    );
  });

  return <CacheProvider value={registry.cache}>{children}</CacheProvider>;
}
