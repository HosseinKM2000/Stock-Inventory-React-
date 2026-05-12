import { FsInput } from "@fs/form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/login")({
  component: () => (
    <div className="bg-slate-400 flex flex-col gap-y-5 text-white justify-center items-center h-dvh w-full">
      <div className="w-[90%] sm:w-90 h-fit">
        <FsInput placeholder="نام کاربری" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsInput placeholder="رمز عبور" type="password" size={"3"} />
      </div>
    </div>
  ),
});
