import { PlusIcon } from "@radix-ui/react-icons";
import { Button } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { accessState } from "@/shared/access/access-state";
import { useEntitlementAccess } from "@/shared/access/use-entitlement";

const AddButton = () => {
  useEntitlementAccess();
  if (!accessState.canWrite()) return null;
  return (
    <Link to="/inventory/add">
      <Button
        aria-label="افزودن محصول"
        className="inventory-add-button fixed! bottom-4! right-4! z-40 p-6! md:right-8! lg:bottom-24!"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <PlusIcon width={"20"} height={"20"} />
      </Button>
    </Link>
  );
};

export default AddButton;
