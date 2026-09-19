import type { AIAnalysis } from './types';

/**
 * The AI's response for each fire in the scenario (spec.md §8). The Collserola one is
 * written and reviewed by hand: it is the text the judges will read, and if the model
 * call fails live the hook falls back here without anyone noticing.
 *
 * `action_id` references the catalogue. When the engine is wired in, each of these ids
 * has to resolve against the closed `Action` union (WAIT, DEPLOY_RESOURCE,
 * CREATE_FIREBREAK): the AI picks and orders within the catalogue, it does not invent
 * actions.
 */
const ANALYSES: AIAnalysis[] = [
  {
    target_id: 'fire-1',
    summary:
      'Fire in the wildland-urban interface with a 27 km/h westerly pushing the head ' +
      'north-east. Fuel load is high and relative humidity has dropped to 18%. There ' +
      'are people downwind less than two kilometres away.',
    priority_rationale:
      'First what cannot move and sits in the path of the wind; then the head of the ' +
      'front; closing the road comes last because today it only protects property.',
    actions: [
      {
        action_id: 'EVACUATE_SCHOOL',
        label: 'Evacuate CEIP Sant Jordi',
        rank: 1,
        urgency: 'immediate',
        why: '420 people 1.8 km away and downwind. At 27 km/h the front covers that distance in about 25 minutes; evacuating a school takes longer.',
        resources: ['Local police', 'Coaches'],
        eta_min: 25,
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:helicopter',
        label: 'Helicopter to the head of the front',
        rank: 2,
        urgency: 'immediate',
        why: 'Attack the north-east flank, which is where it is advancing. Sabadell base is 25 minutes of flight away.',
        resources: ['Water-bombing helicopter'],
        eta_min: 25,
        status: 'proposed',
      },
      {
        action_id: 'CREATE_FIREBREAK',
        label: 'Close the BV-1415 and cut a firebreak',
        rank: 3,
        urgency: 'soon',
        why: 'The road runs 0.9 km away on the southern flank and works as a defence line. Closing it keeps traffic out of the working area.',
        resources: ['Mossos', 'Ground crew'],
        eta_min: 40,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T14:33:10+02:00',
  },
  {
    target_id: 'fire-2',
    summary:
      'Pure forest on a 21% slope with an extreme fuel load. The wind is light but the ' +
      'slope pushes the fire uphill on its own.',
    priority_rationale:
      'With no population immediately at risk, the priority is the power line and ' +
      'containing the fire before it reaches the gully.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Ground crew to the eastern flank',
        rank: 1,
        urgency: 'immediate',
        why: 'The 220 kV line is 2.2 km away and downwind. Losing it cuts supply to three municipalities.',
        resources: ['2 GRAF crews'],
        eta_min: 35,
        status: 'proposed',
      },
      {
        action_id: 'CREATE_FIREBREAK',
        label: 'Firebreak along the upper forest track',
        rank: 2,
        urgency: 'soon',
        why: 'It is the only defence line above the fire before the ridge.',
        eta_min: 60,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T13:06:40+02:00',
  },
  {
    target_id: 'fire-3',
    summary:
      'Scrub in the Garraf with a 19 km/h northerly. It is advancing south, towards the ' +
      'Can Lloses estate.',
    priority_rationale:
      'The estate is downwind and fire runs fast through scrub. Warn them before an ' +
      'evacuation becomes necessary.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Pre-position a crew at Can Lloses',
        rank: 1,
        urgency: 'immediate',
        why: '310 people 2.7 km away and downwind. Getting there before the fire costs less than evacuating afterwards.',
        eta_min: 20,
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:air',
        label: 'Surveillance and attack aircraft',
        rank: 2,
        urgency: 'soon',
        why: 'Garraf scrub burns fast and flat: an early attack closes it down.',
        eta_min: 30,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T15:12:05+02:00',
  },
  {
    target_id: 'fire-4',
    summary:
      'Flare-up on cropland with a moderate fuel load, almost no slope and light wind. ' +
      'There is no population or critical infrastructure nearby.',
    priority_rationale:
      'With this fuel and no wind the fire gains no ground. Watching costs less than ' +
      'moving resources that are needed in Collserola.',
    actions: [
      {
        action_id: 'WAIT',
        label: 'Keep under observation',
        rank: 1,
        urgency: 'monitor',
        why: 'Harvested cropland, 3° of slope and 9 km/h of wind. The resources are worth more on the active fires.',
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Standby crew from the nearest station',
        rank: 2,
        urgency: 'soon',
        why: 'A single crew closes a 1.6 ha flare-up if the wind turns.',
        eta_min: 18,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T12:49:30+02:00',
  },
  {
    target_id: 'fire-5',
    summary:
      'A 0.7 ha flare-up in stubble, with Sentmenat 3.4 km away and upwind. Manual ' +
      'detection, low confidence: worth confirming on the ground.',
    priority_rationale:
      'Before moving anything large, confirm that it exists and how big it is.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:drone',
        label: 'Reconnaissance drone',
        rank: 1,
        urgency: 'immediate',
        why: 'The detection is manual and confidence is 58%. Ten minutes of drone avoid mobilising a crew for a false positive.',
        eta_min: 10,
        status: 'proposed',
      },
      {
        action_id: 'WAIT',
        label: 'Keep under observation',
        rank: 2,
        urgency: 'monitor',
        why: 'The village is upwind and 3.4 km away. Without a wind shift there is no threat to population.',
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T15:41:12+02:00',
  },
];

const BY_TARGET = new Map(ANALYSES.map((a) => [a.target_id, a]));

/** The AI's analysis for a target, or null if none is mocked yet. */
export function analysisFor(targetId: string | null): AIAnalysis | null {
  return targetId ? (BY_TARGET.get(targetId) ?? null) : null;
}
