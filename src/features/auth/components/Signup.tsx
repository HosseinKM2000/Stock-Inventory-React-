import { FsButton, FsTextField } from "@fs/form";
import { preventEventHandler } from "@fs/utils";
import { Link } from "@radix-ui/themes";
import { useState } from "react";
import { signupSchema } from "../validators/signup.schema";

// eslint-disable-next-line react-refresh/only-export-components
function SignupComponent() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    repeatPassword: "",
  });

  const handleInputsChange = (e: {
    target: { name: string; value: string };
  }) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const signupHandler = () => {
    const validationResult = signupSchema.safeParse(form);

    if (!validationResult.success) {
      errorHandler(validationResult);
      return;
    }

    const data = validationResult.data;
    console.log(data);
  };

  const errorHandler = (result) => {
    result.error.issues.forEach((issue) => {
      console.log(issue.message);
    });
  };

  return (
    <form
      onSubmit={preventEventHandler(signupHandler)}
      className="flex flex-col gap-y-5 justify-center items-center h-dvh w-full"
    >
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField
          placeholder="نام"
          size={"3"}
          name="firstName"
          onChange={handleInputsChange}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField
          placeholder="نام خانوادگی"
          size={"3"}
          name="lastName"
          onChange={handleInputsChange}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField
          placeholder="نام کاربری"
          size={"3"}
          name="username"
          onChange={handleInputsChange}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField
          placeholder="رمز عبور"
          type="password"
          size={"3"}
          name="password"
          onChange={handleInputsChange}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsTextField
          placeholder="تکرار رمز عبور"
          type="password"
          size={"3"}
          name="repeatPassword"
          onChange={handleInputsChange}
        />
      </div>
      <div className="w-[90%] sm:w-90 h-fit">
        <FsButton text="ثبت" type="submit" style={{ width: "100%" }} />
      </div>
      <Link href="/login" size={"2"} color="indigo">
        قبلا وارد شده اید !
      </Link>
    </form>
  );
}

export default SignupComponent;
