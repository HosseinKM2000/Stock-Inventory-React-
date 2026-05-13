import { FsButton, FsTextField } from "@fs/form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/login")({
  component: () => (
    <div className="flex flex-col gap-y-5 text-white justify-center items-center h-dvh w-full">
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="نام کاربری" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="رمز عبور" type="password" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsButton text="ورود" style={{ width: "100%" }} />
      </div>
    </div>
  ),
});
