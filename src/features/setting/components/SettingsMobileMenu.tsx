import * as Dialog from "@radix-ui/react-dialog";
import { HamburgerMenuIcon } from "@radix-ui/react-icons";

export function SettingsMobileMenu() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className="
            rounded-md
            p-2
          "
        >
          <HamburgerMenuIcon />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          className="
            fixed
            inset-0
            bg-black/40
            backdrop-blur-sm
          "
        />

        <Dialog.Content
          className="
            fixed
            left-0
            top-0
            h-screen
            w-72
            bg-white
            p-4
            shadow-xl
          "
        >
          <Dialog.Title
            className="
              mb-6
              text-lg
              font-semibold
            "
          >
            Settings
          </Dialog.Title>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
