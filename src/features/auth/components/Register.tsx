import { LockClosedIcon, MobileIcon, PersonIcon } from "@radix-ui/react-icons";
import { Callout } from "@radix-ui/themes";
import { useRef } from "react";

import { ApiError } from "@/shared/api/api-error";
import { useAppForm } from "@/shared/lib/form/use-app-form";
import { preventEventHandler } from "@/shared/lib/prevent-event";
import { Button } from "@/shared/ui/button/button";
import { Form } from "@/shared/ui/form/form";
import { PasswordInput } from "@/shared/ui/form/input/password-input";
import { TextInput } from "@/shared/ui/form/input/text-input";

import { authErrorMessage } from "../auth-error";
import { DUPLICATE_MOBILE_MESSAGE } from "../mobile";
import { useRegister } from "../mutations/use-register";
import { registerSchema } from "../validators/register.schema";
import { AuthPageShell } from "./AuthPageShell";

function RegisterComponent() {
  const registerMutation = useRegister();
  const submittingRef = useRef(false);
  const form = useAppForm({
    schema: registerSchema,
    initialValues: { username: "", phone: "", password: "", repeatPassword: "" },
    onSubmit(values) {
      if (submittingRef.current) return;
      submittingRef.current = true;
      registerMutation.mutate(
        { username: values.username, phone: values.phone, password: values.password },
        {
          onError(error) {
            if (error instanceof ApiError && error.message === DUPLICATE_MOBILE_MESSAGE) form.setFieldError("phone", DUPLICATE_MOBILE_MESSAGE);
          },
          onSettled: () => { submittingRef.current = false; },
        },
      );
    },
  });
  const duplicatePhoneError = registerMutation.error instanceof ApiError && registerMutation.error.message === DUPLICATE_MOBILE_MESSAGE;
  const serverError = registerMutation.isError && !duplicatePhoneError
    ? authErrorMessage(registerMutation.error, "ساخت حساب انجام نشد. اتصال اینترنت را بررسی و دوباره تلاش کنید.")
    : null;

  return (
    <AuthPageShell title="ساخت حساب تنظیم" description="در حال حاضر فقط اطلاعات ورود نیاز است و می‌توانید جزئیات پروفایل خود را بعداً تکمیل کنید." badge="راه‌اندازی سریع مدیریت موجودی و کسب‌وکار" descriptionAfterBadge switchText="از قبل حساب دارید؟" switchLabel="وارد شوید" switchTo="/auth/login" trustText="با ساخت حساب، قوانین استفاده و حریم خصوصی را می‌پذیرید.">
      <section className="auth-card" aria-label="فرم ساخت حساب">
        {serverError ? <Callout.Root color="red" dir="rtl" className="auth-server-error" role="alert"><Callout.Text>{serverError}</Callout.Text></Callout.Root> : null}
        <Form className="auth-form" dir="rtl" noValidate isDirty={form.isDirty} isSubmitting={registerMutation.isPending} onSubmit={preventEventHandler(form.submit)}>
          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-username"><PersonIcon /> نام کاربری</label>
            <TextInput id="register-username" className="auth-input" name="username" autoComplete="username" dir="ltr" placeholder="مثلاً tanzim.store" value={form.values.username} onChange={form.handleChange} aria-invalid={Boolean(form.errors.username)} aria-describedby="register-username-help" />
            <p id="register-username-help" className={form.errors.username ? "auth-field-error" : "auth-field-description"}>{form.errors.username ?? "نامی یکتا و به‌یادماندنی برای ورود به حساب خود انتخاب کنید."}</p>
          </div>

          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-phone"><MobileIcon /> شماره موبایل</label>
            <TextInput id="register-phone" className="auth-input" name="phone" inputMode="numeric" autoComplete="tel" dir="ltr" placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹" value={form.values.phone} onChange={form.handleChange} aria-invalid={Boolean(form.errors.phone)} aria-describedby="register-phone-help" />
            <p id="register-phone-help" className={form.errors.phone ? "auth-field-error" : "auth-field-description"}>{form.errors.phone ?? "برای دریافت اطلاعیه‌ها و امنیت حساب استفاده می‌شود."}</p>
          </div>

          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-password"><LockClosedIcon /> رمز عبور</label>
            <PasswordInput id="register-password" className="auth-input" name="password" eyeSide="left" autoComplete="new-password" placeholder="رمز عبور خود را وارد کنید" value={form.values.password} onChange={form.handleChange} aria-invalid={Boolean(form.errors.password)} aria-describedby="register-password-help" />
            <p id="register-password-help" className={form.errors.password ? "auth-field-error" : "auth-field-description"}>{form.errors.password ?? "حداقل ۸ کاراکتر، شامل حرف بزرگ، حرف کوچک و عدد."}</p>
          </div>

          <div className="auth-field">
            <label className="auth-field-label" htmlFor="register-repeat-password"><LockClosedIcon /> تکرار رمز عبور</label>
            <PasswordInput id="register-repeat-password" className="auth-input" name="repeatPassword" eyeSide="left" autoComplete="new-password" placeholder="رمز عبور را دوباره وارد کنید" value={form.values.repeatPassword} onChange={form.handleChange} aria-invalid={Boolean(form.errors.repeatPassword)} aria-describedby={form.errors.repeatPassword ? "register-repeat-password-error" : undefined} />
            {form.errors.repeatPassword ? <p id="register-repeat-password-error" className="auth-field-error">{form.errors.repeatPassword}</p> : null}
          </div>

          <Button type="submit" className="auth-submit" loading={registerMutation.isPending}>ساخت حساب</Button>
        </Form>
      </section>
    </AuthPageShell>
  );
}

export default RegisterComponent;
