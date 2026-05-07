import { kvGet, kvSet } from '../lib/storage';

const DB_KEY = 'beef_contests_v7_final';

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const body = await req.json();
    const { contestId, userId, displayName, payoutAddress } = body;
    if (!contestId || !userId || typeof userId !== 'number') {
      return new Response(JSON.stringify({ error: 'Bad Request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contests = (await kvGet<any[]>(DB_KEY)) || [];

    const contestIdx = contests.findIndex((c: any) => c.id === contestId);
    if (contestIdx === -1)
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

    const contest = contests[contestIdx];
    if (contest.isCompleted) {
      return new Response(JSON.stringify({ error: 'Contest Already Finished' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const participants: any[] = contest.giveawayParticipants || [];
    if (participants.some((p: any) => p.userId === userId)) {
      return new Response(JSON.stringify({ error: 'already_participated' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const disp =
      typeof displayName === 'string' && displayName.trim()
        ? displayName.trim()
        : `User ${userId}`;
    const payout =
      typeof payoutAddress === 'string' && payoutAddress.trim()
        ? payoutAddress.trim()
        : undefined;

    const isFake = contest.isFakeGiveaway === true;
    let nextContest: Record<string, any>;

    if (isFake) {
      const botsToAdd = Math.floor(Math.random() * 2) + 1;
      const totalAdd = 1 + botsToAdd;
      const myTicket = (contest.lastTicketNumber || 0) + 1;
      const botTickets: number[] = [];
      for (let i = 1; i <= botsToAdd; i++) {
        botTickets.push(myTicket + i);
      }
      const entry = {
        userId,
        ticketNumber: myTicket,
        displayName: disp,
        payoutAddress: payout,
      };
      nextContest = {
        ...contest,
        participantCount: (contest.participantCount || 0) + totalAdd,
        realParticipantCount: (contest.realParticipantCount || 0) + 1,
        lastTicketNumber: (contest.lastTicketNumber || 0) + totalAdd,
        giveawayParticipants: [...participants, entry],
        botTicketNumbers: [...(contest.botTicketNumbers || []), ...botTickets],
      };
    } else {
      const myTicket = (contest.lastTicketNumber || 0) + 1;
      const entry = {
        userId,
        ticketNumber: myTicket,
        displayName: disp,
        payoutAddress: payout,
      };
      nextContest = {
        ...contest,
        participantCount: (contest.participantCount || 0) + 1,
        realParticipantCount: (contest.realParticipantCount || 0) + 1,
        lastTicketNumber: myTicket,
        giveawayParticipants: [...participants, entry],
      };
    }

    contests[contestIdx] = nextContest;

    await kvSet(DB_KEY, contests);

    const myTicketFinal = nextContest.giveawayParticipants[nextContest.giveawayParticipants.length - 1].ticketNumber;

    return new Response(
      JSON.stringify({
        success: true,
        ticketNumber: myTicketFinal,
        updatedContests: contests,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Participation API Error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
