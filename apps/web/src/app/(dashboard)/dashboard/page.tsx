import { RoomList } from "@/components/room/RoomList";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your rooms</h1>
        <p className="text-sm text-muted-foreground">
          Jump back into a session or create a new room.
        </p>
      </div>
      <RoomList />
    </div>
  );
}
