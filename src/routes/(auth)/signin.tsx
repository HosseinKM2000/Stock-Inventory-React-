import { Link } from "@radix-ui/themes";
import { FsButton, FsTextField } from "@fs/form";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/signin")({
  component: () => (
    <div className="flex flex-col gap-y-5 justify-center items-center h-dvh w-full">
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="نام کاربری" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="رمز عبور" type="password" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsButton text="ثبت" style={{ width: "100%" }} />
      </div>
      <Link href="/login" size={"2"} color="indigo">
        قبلا وارد شده اید !
      </Link>
    </div>
  ),
});
