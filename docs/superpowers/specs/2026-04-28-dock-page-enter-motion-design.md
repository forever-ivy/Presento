# Dock Page Enter Motion Design

## Goal

Clicking the dock should transition into the destination page with a cinematic dolly-in effect. The dock itself remains a trigger; the main animation is the page entrance.

## Motion Direction

Use a restrained camera push:

- The current flow canvas stays visible first so the user keeps spatial context.
- The React Flow viewport first zooms from the full map into the active business node, placing it in the screen center as a large close-up.
- The destination room shell starts from the centered, enlarged card bounds, matching the iOS app-open gesture instead of opening from the center.
- The destination room shell expands from that card area while the canvas scales forward, softens, and fades into the background.
- Route navigation is committed after the visual transition completes, so the movement happens on the existing graph instead of on a newly mounted route instance.
- The real page content settles after the shell completes most of its expansion.

## Timing

- 0-620ms: viewport zooms from the full map into the target node close-up.
- 620-1180ms: expand the room shell from that focused card into the full page.
- 1180-1240ms: hand off from shell to real page content.
- After 1240ms: update the URL and mount the destination route directly in its final state.

## Variants

- Standard rooms use the softest push.
- Explore rooms push a little deeper to reinforce map exploration.
- Immersive rooms use the strongest zoom, vignette, and easing.

## Accessibility

Respect `prefers-reduced-motion` by skipping the dolly sequence and applying final states directly.
