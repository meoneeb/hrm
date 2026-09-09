import { z } from "zod";
import { eachDayOfInterval, parseISO, format } from "date-fns";
import { dbConnect } from "@/lib/db";
import { Leave } from "@/models/Leave";
import { Attendance } from "@/models/Attendance";
import { User } from "@/models/User";
import { requireUser, assertOrgAccess, canApproveLeave } from "@/lib/rbac";
import { jsonOk, jsonErr } from "@/lib/utils";
import { serialize } from "@/lib/serializers";

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (!canApproveLeave(user!)) return jsonErr("Forbidden", 403);

  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return jsonErr("Invalid body", 400);

  await dbConnect();
  const leave = await Leave.findById(id);
  if (!leave) return jsonErr("Not found", 404);
  if (leave.status !== "pending") return jsonErr("Already decided", 400);

  const denied = assertOrgAccess(user!, String(leave.orgId));
  if (denied) return denied;

  leave.status = parsed.data.status;
  leave.decidedBy = user!.id as never;

  if (parsed.data.status === "approved") {
    const member = await User.findById(leave.userId);
    if (member) {
      let credit = member.credits.find(
        (c: { typeId: unknown; balance: number }) =>
          String(c.typeId) === String(leave.typeId)
      );
      if (credit) {
        credit.balance = credit.balance - leave.days;
      } else {
        member.credits.push({
          typeId: leave.typeId as never,
          balance: -leave.days,
        } as never);
      }
      await member.save();
    }

    const days = eachDayOfInterval({
      start: parseISO(leave.from),
      end: parseISO(leave.to),
    });
    for (const day of days) {
      const date = format(day, "yyyy-MM-dd");
      await Attendance.findOneAndUpdate(
        { userId: leave.userId, orgId: leave.orgId, date },
        {
          $set: {
            status: "leave",
            userId: leave.userId,
            orgId: leave.orgId,
            date,
          },
        },
        { upsert: true }
      );
    }
  }

  await leave.save();
  return jsonOk(serialize(leave), "Updated");
}
