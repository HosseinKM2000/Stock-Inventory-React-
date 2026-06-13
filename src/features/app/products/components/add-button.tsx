import { PlusIcon } from "@radix-ui/react-icons";
import { Button } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";

const AddButton = () => {
  return (
    <Link to="/product/add">
      <Button className="fixed! bottom-25! right-7! md:bottom-25! md:right-10! p-6!">
        <PlusIcon width={"20"} height={"20"} />
      </Button>
    </Link>
  );
};

export default AddButton;
