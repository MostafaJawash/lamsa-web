/**
 * Pages visited in this tab since the app loaded (client only), counted by the tabbar,
 * which stays mounted across navigations. With more than one, "back" can use the browser
 * history; on a page opened directly (deep link) it goes home instead.
 */
let visitedPages = 0;

export function recordVisit(): void {
  visitedPages += 1;
}

export function canGoBack(): boolean {
  return visitedPages > 1;
}
