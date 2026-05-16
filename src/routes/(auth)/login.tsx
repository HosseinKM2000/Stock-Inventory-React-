import { FsButton, FsTextField } from "@fs/form";
import { Link } from "@radix-ui/themes";
import { createFileRoute } from "@tanstack/react-router";
import { keycloak } from "src/core/auth/keycloak";

const user = keycloak.tokenParsed;
console.log(user);

export const Route = createFileRoute("/(auth)/login")({
  component: () => (
    <div className="flex flex-col gap-y-5 justify-center items-center h-dvh w-full">
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="نام کاربری" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField placeholder="رمز عبور" type="password" size={"3"} />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsButton text="ورود" style={{ width: "100%" }} />
      </div>
      <Link href="/signup" size={"2"} color="indigo">
        هنوز حسابی ندارید!
      </Link>
    </div>
  ),
});
