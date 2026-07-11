import { Button } from "@/shared/ui/button/button";
import { TextInput } from "@/shared/ui/form/input/text-input";

import {
  MagnifyingGlassIcon,
  TextAlignTopIcon,
} from "@radix-ui/react-icons";

import {
  Flex,
  Popover,
  RadioGroup,
  Text,
} from "@radix-ui/themes";

import type { ProductSort } from "../types";


const SORT_LABELS: Record<ProductSort, string> = {
  newest: "جدیدترین",
  price_desc: "بیشترین قیمت",
  price_asc: "کمترین قیمت",
  name: "نام",
};


type Props = {
  search: string;

  setSearch: (
    value:string
  ) => void;


  sort: ProductSort;

  setSort: (
    value:ProductSort
  ) => void;
};



export default function FilterPanel({
  search,
  setSearch,
  sort,
  setSort,
}:Props) {


  return (

    <Flex
      direction="column"
      gap="3"
      width="100%"
    >


      {/* Search */}

      <TextInput

        className="w-full"

        rightSlot={

          <Button
            variant="ghost"
            ml="1"
            type="button"
          >

            <MagnifyingGlassIcon
              width="20"
              height="20"
            />

          </Button>

        }


        size="3"

        placeholder="جستجوی محصول..."

        value={search}

        onChange={(event)=> 
          setSearch(event.target.value)
        }

      />



      {/* Sort */}

      <Popover.Root>

        <Popover.Trigger>

          <Button
            variant="soft"
            className="w-full"
          >

            <Flex
              align="center"
              gap="2"
            >

              <TextAlignTopIcon
                width="20"
                height="18"
              />


              <Text size="2">

                مرتب سازی:
                {" "}
                {SORT_LABELS[sort]}

              </Text>


            </Flex>


          </Button>


        </Popover.Trigger>



        <Popover.Content
          width="280px"
        >


          <RadioGroup.Root

            value={sort}

            onValueChange={(value)=> 
              setSort(value as ProductSort)
            }

          >


            <Flex

              direction="column"

              gap="3"

              align="end"

            >


              {
                (
                  Object.keys(
                    SORT_LABELS
                  ) as ProductSort[]
                )
                .map((key)=>(


                  <Flex

                    key={key}

                    align="center"

                    gap="2"

                  >


                    <Text
                      size="2"
                      weight="bold"
                    >

                      {
                        SORT_LABELS[key]
                      }

                    </Text>


                    <RadioGroup.Item
                      value={key}
                    />


                  </Flex>


                ))
              }


            </Flex>


          </RadioGroup.Root>


        </Popover.Content>


      </Popover.Root>


    </Flex>

  );
}