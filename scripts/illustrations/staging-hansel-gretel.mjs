// 「헨젤과 그레텔」 장면별 연출 메모 - 그림마다 "누가, 어디에, 누구 몰래, 무엇을, 소품은 몇 개"를 영어로 못 박는다.
// 10/24 QA: 동화 문장(한국어)과 인물 목록만 넘기니 모델이 모두를 한 줄로 세워 그렸다(엿듣는 장면에서 아이들이 부모 옆에
// 서 있음, 몰래 떨어뜨리는 돌·빵을 대놓고 버림, 헨젤 두 명, 빵 한 조각이 큰 빵 한 덩이, 갑자기 가방, 창살을 뚫은 얼굴).
// build-jobs.mjs가 이 메모를 STORY 대신 넣는다. 메모가 없는 그림은 build-jobs가 오류로 멈춘다.
//
// 칸: shot(카메라·구도), stage(누가 어디서 무엇을 - 숨거나 몰래 하는 관계까지), props(소품 개수·상태, 없는 것),
//     hidden(true면 "모두 무릎까지 보이게" 구도 규칙을 빼고 숨은 인물은 일부만 보여도 된다).

/** 그림 전체에 붙는 소품 연속성 - 장면 메모의 props가 이보다 우선한다. */
export const CONTINUITY_RULES = {
  // 과자집을 나올 때(candy-house-exit) 처음 가방을 멘다. 그 전 그림에는 가방·배낭·끈이 없어야 한다.
  noBag: 'Neither child carries any bag, backpack, satchel or strap.',
  bag: 'Each child carries one small cloth bundle bag (packed bread and water) - the same small bags in every picture from now on.',
};

/** 가방을 멘 그림(과자집을 나온 뒤 집에 닿기 전). 나머지는 noBag. */
export const BAG_SCENES = new Set(['candy-house-exit', 'waterway-obstacle', 'water-return', 'marked-return-path']);

export const STAGING = {
  'home-table': {
    shot: 'Medium-wide shot of the small cottage kitchen, eye level.',
    stage:
      'Father sits at the round table with his head in his hands, worried. Stepmother stands beside the table, arms crossed, looking at the nearly empty table. Hansel and Gretel sit together on a bench at the other side of the table, looking at the single piece of bread, hungry and quiet.',
    props:
      'POVERTY: the table holds only ONE small heel of bread on a plain wooden plate and empty cups - no loaves, no bowls of food, no fruit. Empty shelves, an empty bread basket.',
  },
  'night-plan': {
    hidden: true,
    shot: 'Medium-wide shot across the dim cottage kitchen at night; the children are small in the frame, at the edge.',
    stage:
      'Stepmother and Father talk at the round table by one oil lamp: Stepmother leans in, insisting; Father looks down, torn and unhappy. They do NOT see the children. Hansel and Gretel are HIDING in the dark doorway of the side bedroom at the far left, only their heads and hands peeking around the door frame, eavesdropping with frightened faces.',
    props: 'No food on the table. The bedroom door is half open; the children are partly behind it.',
  },
  'pebble-collection': {
    shot: 'Medium shot outside the cottage front door at night.',
    stage:
      'EXACTLY ONE child: Hansel alone, crouching on the path just outside the front door, quietly picking up white pebbles from the ground and putting them into his trouser pocket, glancing back at the dark house. Gretel is NOT in this picture. No second boy, no duplicate Hansel.',
    props: 'A few glowing-white pebbles on the moonlit path; the cottage door slightly open behind him, the house dark inside.',
  },
  'first-walk-pebbles': {
    shot: 'Wide shot along a forest path, the adults ahead in the upper middle, the children following behind.',
    stage:
      'Father and Stepmother walk AHEAD on the path with their backs to the children, not looking back (Father carries an axe on his shoulder). A few steps BEHIND them, Hansel and Gretel follow; Hansel secretly lets one white pebble slip from his hand at his side while Gretel walks close beside him, glancing at the adults to make sure they do not notice.',
    props: 'A trail of small white pebbles on the path behind the children. No bread.',
  },
  'forest-waiting': {
    shot: 'Medium-wide shot of a small forest clearing.',
    stage:
      'Hansel and Gretel stand by a small log in the clearing, watching; Father and Stepmother walk away down the path in the distance, Father turning his head back once, Stepmother pulling him on. The children look uncertain.',
    props: 'A small campfire by the log. No bags, no food.',
  },
  'forest-night-waiting': {
    shot: 'Medium shot of the two children in the dark forest clearing.',
    stage:
      'Hansel and Gretel sit close together on the log by a dying campfire, alone at night. Gretel hugs her knees, worried; Hansel looks up at the cloudy sky, waiting for the moon.',
    props: 'Only the two children. The campfire is almost out. The moon is hidden behind clouds.',
  },
  'moonlit-return': {
    shot: 'Wide shot of the forest path at night, the path leading into the distance.',
    stage:
      'The moon has come out. Hansel and Gretel walk hand in hand along the path, following a line of white pebbles that glow in the moonlight toward home.',
    props: 'A clear trail of glowing white pebbles. The cottage is far in the distance, small.',
  },
  'first-homecoming': {
    shot: 'Medium-wide shot at the cottage doorway at dawn.',
    stage:
      'Father kneels at the open front door and hugs both children tightly, eyes closed, speechless with relief and guilt. Stepmother stands behind him in the room, stiff and surprised, not hugging anyone.',
    props: 'No food on the table behind them.',
  },
  'second-night-plan': {
    hidden: true,
    shot: 'Medium-wide shot of the cottage kitchen at night, seen from beside the children\'s bedroom door.',
    stage:
      'In the foreground edge, the children\'s bedroom door is open only a crack: Hansel and Gretel are INSIDE the dark bedroom, in their nightclothes over their usual clothes, peeking through the narrow gap, only parts of their faces visible, listening. In the kitchen beyond, Stepmother points toward the window and the forest while Father shakes his head sadly. The adults do NOT see the children.',
    props: 'The table is empty except one oil lamp and an empty bowl.',
  },
  'locked-door-night': {
    shot: 'Medium shot at the inside of the cottage front door at night.',
    stage:
      'Hansel pulls the handle of the front door with both hands but it does not open - it is locked with a heavy bolt and padlock on the inside. Gretel stands beside him holding a candle, whispering. Both are worried. Only the two children.',
    props: 'A heavy iron bolt with a padlock on the door. No pebbles in the house.',
  },
  'morning-bread-plan': {
    shot: 'Medium close shot of the children by the bedroom window in the morning.',
    stage:
      'Hansel holds the ONE small piece of bread he was given and quietly breaks off tiny crumbs into his trouser pocket. Gretel stands close, whispering, understanding his plan. Only the two children.',
    props:
      'POVERTY: exactly ONE small piece of bread, smaller than Hansel\'s hand - no loaves, no bowl, no basket of bread, no other food anywhere.',
  },
  'second-walk-breadcrumbs': {
    shot: 'Wide shot of a darker, deeper forest path; adults ahead in the upper middle, children behind.',
    stage:
      'Father and Stepmother walk AHEAD with their backs to the children; Stepmother leads briskly, Father follows with an axe. Several steps BEHIND them, Hansel quietly drops a tiny breadcrumb from his hand behind his back while Gretel walks beside him, watching Stepmother\'s back so she will not see.',
    props: 'A few tiny breadcrumbs on the path behind the children. No pebbles. No bags.',
  },
  'deep-forest-waiting': {
    shot: 'Medium-wide shot of a deep forest clearing at sunset.',
    stage:
      'Hansel and Gretel sit alone on a tree root, waiting; the path where the adults left is empty. Gretel looks down the empty path, Hansel holds her hand. The light is fading.',
    props: 'Only the two children. A tiny campfire. No adults visible anywhere.',
  },
  'birds-eat-breadcrumbs': {
    shot: 'Medium-wide shot of the forest path at night. The birds are at the children’s CHEST height in the CENTER of the frame - nothing important in the lower half.',
    stage:
      'A row of small brown forest birds perches along a fallen tree trunk lying across the path at the children’s chest height, pecking up the last breadcrumbs from the top of the trunk. Hansel and Gretel stand behind the trunk, dismayed; Hansel points at the birds, Gretel puts a hand over her mouth. The ground below is empty.',
    props: 'Four or five small brown birds, clearly visible at mid-height of the picture. Almost no crumbs left. No white bird.',
  },
  'lost-forest': {
    shot: 'Wide shot of a tangled forest with many similar paths in the morning.',
    stage:
      'Hansel and Gretel walk wearily hand in hand among tall trees, looking around, lost; several paths look the same. They are tired and hungry.',
    props: 'Empty-handed: no bag, no backpack, no straps, no basket.',
  },
  'morning-song': {
    shot: 'Medium-wide shot under a big tree in the morning forest.',
    stage:
      'Hansel and Gretel sit resting against the trunk of a big tree, tired; both lift their heads, hearing a bright birdsong from above. The singing bird is hidden in the leaves (only small, not the main subject).',
    props: 'No bags. No white bird visible yet.',
  },
  'white-bird': {
    shot: 'Medium-wide shot; the white bird is LARGE and clearly visible in the upper middle of the frame, not hidden by leaves.',
    stage:
      'A snow-white bird sits on a low bare branch at the upper middle of the picture, in an open patch of light, looking back at the children. Hansel and Gretel stand below at the left, looking up at it with curiosity; Gretel points to the bird.',
    props: 'Exactly one white bird, clearly separated from leaves and branches; no other birds.',
  },
  'white-bird-leads': {
    shot: 'Wide shot of a sunny forest path.',
    stage:
      'The white bird flies ahead along the path at the upper middle of the frame; Hansel and Gretel follow it hand in hand, Hansel sniffing the air (a sweet smell). Far down the path, only a hint of a colorful roof between the trees.',
    props: 'Exactly one white bird. No bags.',
  },
  'candy-house-reveal': {
    shot: 'Wide establishing shot of a forest clearing.',
    stage:
      'Between the trees appears a cottage made of bread and cookies with sparkling sugar windows. Hansel and Gretel stand at the edge of the clearing, amazed; Gretel holds up both hands in delight. The white bird sits on the roof.',
    props: 'The door is closed. No people other than the two children.',
  },
  'candy-house-close': {
    shot: 'Medium shot in front of the candy house door.',
    stage:
      'Hansel and Gretel stand before the closed door of the candy house, smelling warm bread; Hansel reaches toward a cookie on the wall but hesitates. Only the two children.',
    props: 'The door is closed. No bags.',
  },
  'old-woman-door': {
    shot: 'Medium-wide shot of the open candy house doorway.',
    stage:
      'The door has opened: a small, kindly-looking old woman stands in the doorway, smiling and gesturing them inside. Hansel and Gretel stand in front of the door, tired and shy, holding hands.',
    props: 'No bags.',
  },
  'candy-house-interior': {
    shot: 'Medium-wide shot of a warm dining corner inside the candy house in the evening.',
    stage:
      'Hansel and Gretel sit at a small wooden table eating bread and drinking water from cups, relieved; the old woman sets down a jug of water, smiling. In the background two small beds stand ready side by side.',
    props: 'Two small plates of bread, two cups, one water jug. NO cage and NO oven in this room (this is the dining-bedroom, not the kitchen).',
  },
  'candy-house-sleep': {
    shot: 'Medium shot of the small bedroom corner at night.',
    stage:
      'Hansel and Gretel lie asleep side by side in two small beds placed next to each other, blankets pulled up, peaceful after a long day. Nobody else is in the picture.',
    props: 'One small candle on a stool, almost out. NO cage, NO oven, NO old woman.',
  },
  'kitchen-door-locked': {
    shot: 'Medium-wide shot of the candy house kitchen in the morning.',
    stage:
      'The old woman stands at the heavy wooden kitchen door, turning a big black key in its lock with her back half to the children, her smile gone. Hansel and Gretel stand in the middle of the kitchen near the worktable, turning toward the door in surprise. The tall iron cage at the left is EMPTY and its door is open.',
    props: 'Breakfast bowls on the worktable. The key ring holds exactly two keys.',
  },
  'witch-reveal': {
    shot: 'Medium-wide shot of the kitchen; the cage at the left, characters in the middle.',
    stage:
      'The witch (the same old woman, now stern) has just shut the cage door and turns the small silver key in its lock. Hansel stands INSIDE the tall iron cage, both hands holding the bars, his face BEHIND the bars (bars in front of his face, nothing passing through them). Gretel stands outside in the middle of the kitchen, frightened.',
    props: 'The key ring with exactly two keys (small silver, big black) in the witch\'s hand.',
  },
  'gretel-watches-keys': {
    shot: 'Medium shot of the kitchen from beside the worktable.',
    stage:
      'The witch hangs a key ring with exactly two keys on her waist belt while stirring a bowl. Gretel, at the worktable with a bowl of ingredients, secretly watches the keys out of the corner of her eye. Hansel is inside the cage at the left, behind the bars.',
    props: 'Exactly two keys on the ring: one small silver, one big black.',
  },
  'gretel-whispers-keys': {
    shot: 'Medium close shot at the cage; the witch small in the background with her back turned.',
    stage:
      'Gretel stands OUTSIDE the cage, leaning close to the bars and whispering. Hansel is INSIDE the cage, leaning toward her, his face clearly BEHIND the iron bars - the bars pass in front of his face and his head never pokes through them. In the background the witch faces the stove, not looking.',
    props: 'Solid, evenly spaced vertical bars too narrow for a head. One Hansel, one Gretel, one witch.',
  },
  'witch-cooking-keys': {
    shot: 'Medium-wide shot of the kitchen.',
    stage:
      'The witch lifts a big pot at the stove; she has put the key ring down at the far end of the worktable. Gretel stands near the worktable looking at the keys; the witch glances back over her shoulder toward the children. Hansel is inside the cage at the left, behind the bars.',
    props: 'The key ring (exactly two keys) lies alone at the end of the worktable.',
  },
  'wait-and-take-keys': {
    shot: 'Medium-wide shot of the kitchen.',
    stage:
      'The witch faces AWAY at the back shelf, searching for a pot lid with both hands. Behind her back, Gretel tiptoes to the worktable and picks up the key ring. Hansel watches from inside the cage at the left, behind the bars.',
    props: 'Exactly two keys on the ring in Gretel\'s hand.',
  },
  'cage-unlock-oven-secured': {
    shot: 'Medium shot at the cage.',
    stage:
      'Gretel turns the small silver key in the cage lock; the cage door swings open and Hansel steps OUT quietly. The witch is still at the back shelf with her back turned, not noticing.',
    props: 'Gretel holds the ring with exactly two keys.',
  },
  'black-key-side-door': {
    shot: 'Medium-wide shot from inside the kitchen toward the kitchen door.',
    stage:
      'Gretel has opened the heavy kitchen door with the big black key; Hansel is already slipping through into the corridor. At the back of the kitchen, the witch - the SAME small old woman with grey hair, cream kerchief and plum shawl - turns around and shouts.',
    props: 'The open, now-empty cage at the far left. Exactly two keys on the ring.',
  },
  'corridor-lock-door': {
    shot: 'Medium shot in the corridor, outside the kitchen door.',
    stage:
      'In the corridor, Gretel turns the big black key in the closed kitchen door to lock it while Hansel pushes the door shut with both hands. The witch is NOT visible (she is inside the kitchen, behind the closed door).',
    props: 'Corridor only: NO cage, NO oven here. Candy-studded walls, the outside door at the far end.',
  },
  'escape-corridor': {
    shot: 'Medium-wide shot down the corridor toward the bright outside door.',
    stage: 'Hansel and Gretel run hand in hand down the corridor toward the open outside door at the far end.',
    props: 'Corridor only: NO cage, NO oven, no witch. No bags yet.',
  },
  'storehouse': {
    shot: 'Medium shot at a small storeroom doorway off the corridor.',
    stage:
      'Hansel and Gretel stop at a storeroom door that stands slightly open; inside are shelves with a few loaves of bread and water bottles. Hansel points inside, thinking about the long walk home.',
    props: 'Storeroom only: NO cage, NO oven, no witch. No bags yet.',
  },
  'packing-food': {
    shot: 'Medium shot inside the small storeroom.',
    stage:
      'Hansel and Gretel each put one small loaf of bread and one small water bottle into a small cloth bundle bag. Gretel nods toward the door: time to go.',
    props: 'Storeroom only: NO cage, NO oven, no witch. Exactly two small cloth bags.',
  },
  'candy-house-exit': {
    shot: 'Medium-wide shot outside the candy house.',
    stage: 'Hansel and Gretel step out of the candy house door into the forest, each carrying a small cloth bundle bag, looking ahead with determination.',
    props: 'The two small cloth bags from the storeroom.',
  },
  'waterway-obstacle': {
    shot: 'Wide shot of the wide waterway.',
    stage:
      'Hansel and Gretel stand on the grassy bank of a wide waterway with no bridge and no boat. The white bird sings from a branch above; a large white duck swims toward them.',
    props: 'Their two small cloth bags. Exactly one white bird and one white duck.',
  },
  'water-return': {
    shot: 'Wide shot of the waterway.',
    stage:
      'The large white duck carries ONE child across the water: Gretel rides on its back, holding on gently. Hansel waits on the near bank, waving. They cross one at a time.',
    props: 'Only one child on the duck. Their small cloth bags.',
  },
  'marked-return-path': {
    shot: 'Medium-wide shot of the forest on the far bank.',
    stage:
      'Hansel and Gretel walk toward a tree with a white cloth tied to a branch; through the trees beyond, the familiar roof of their own cottage is visible.',
    props: 'One white cloth tied on the branch. Their small cloth bags.',
  },
  'home-promise': {
    shot: 'Medium shot in front of the cottage.',
    stage:
      'Father kneels in front of Hansel and Gretel outside the cottage, holding their hands, apologizing with tears in his eyes. The children look at him seriously. Stepmother is NOT here.',
    props: 'A few white cloths (like the one on the tree) in Father\'s pocket. The children have put their bags down beside them.',
  },
  'window-epilogue': {
    shot: 'Medium-wide shot of the cottage kitchen in the evening.',
    stage:
      'Father and the two children sit together at the table, talking and smiling; a kind neighbor woman (not the stepmother, not the old woman) brings a basket of vegetables through the open door.',
    props: 'A modest meal: one loaf and a pot of soup. Stepmother is NOT here.',
  },
  'a-observe-bird-01': {
    shot: 'Medium-wide shot; the white bird is large and clearly visible in the upper middle.',
    stage:
      'Hansel and Gretel stand still on the path, watching quietly. The white bird sits on a branch a little ahead in the upper middle of the picture and looks back at them over its shoulder.',
    props: 'Exactly one white bird, clearly separated from the leaves.',
  },
  'a-speak-to-bird-01': {
    shot: 'Medium-wide shot; the white bird is large and clearly visible in the upper middle.',
    stage:
      'Gretel calls up to the white bird with a hand at her mouth; the bird, on a branch in the upper middle, chirps and flutters toward the path ahead. Hansel looks where it is going.',
    props: 'Exactly one white bird.',
  },
  'c-wait-for-witch-turn-01': {
    shot: 'Medium-wide shot of the kitchen.',
    stage:
      'The old woman stands at the back shelf, busy looking for a pot lid. Gretel quietly picks up the key ring from the worktable. Hansel waits in the tall iron cage at the left, hopeful.',
    props: 'Exactly two keys on the ring.',
  },
  'c-distract-and-take-keys-01': {
    shot: 'Medium-wide shot of the kitchen.',
    stage:
      'Hansel, inside the cage at the left, calls out to the witch; the witch turns toward HIM, away from the worktable. At the same moment, Gretel quietly takes the key ring from the worktable with her own hand. The witch does NOT hand anything to Gretel and does not look at her.',
    props: 'The key ring (exactly two keys) is in Gretel\'s hand, never in the witch\'s hand.',
  },
  'a-try-thick-bushes': {
    shot: 'Medium shot of a wall of thick bushes on the path.',
    stage: 'Gretel pushes into a wall of thick bushes with both hands but cannot get through; Hansel watches. The white bird waits on a branch above.',
    props: 'No bags.',
  },
  'a-try-thorn-brambles': {
    shot: 'Medium shot of a thorny bramble wall.',
    stage: 'A wall of thorny brambles blocks the path; Gretel reaches out and carefully pulls her hand back. Hansel holds her other hand. The white bird waits above.',
    props: 'Nobody is hurt. No bags.',
  },
  'a-try-back-to-start': {
    shot: 'Wide shot of a forest crossing with tangled paths.',
    stage: 'Hansel and Gretel stand at a crossing of tangled paths, realizing they are back where they started - the same split tree stump beside them. The white bird waits on a branch above.',
    props: 'No bags.',
  },
  'c-try-high-window': {
    shot: 'Medium-wide shot of the kitchen.',
    stage: 'Gretel stretches on tiptoe toward a small high window but cannot reach it. The witch stirs a pot at the stove with her back turned. Hansel watches from inside the cage at the left.',
    props: 'The key ring (two keys) still on the worktable.',
  },
  'c-try-locked-door': {
    shot: 'Medium-wide shot of the kitchen.',
    stage: 'Gretel pulls the handle of the locked kitchen door with both hands but it does not open. The witch stirs a pot at the stove with her back turned. Hansel watches from inside the cage at the left.',
    props: 'The key ring (two keys) still on the worktable.',
  },
  'c-try-narrow-chimney': {
    shot: 'Medium-wide shot of the kitchen.',
    stage: 'Gretel looks into the narrow opening of a small chimney flue in the wall; it is clearly far too small for her shoulders. The witch stirs a pot with her back turned. Hansel watches from inside the cage at the left.',
    props: 'The key ring (two keys) still on the worktable.',
  },
};
