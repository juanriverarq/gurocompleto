
import { IconCalendarMonth } from '@tabler/icons-react'
import { Datepicker } from 'flowbite-react'
import CardBox from 'src/components/shared/CardBox'
import CodeModal from '../CodeModal'

const AutoHide = () => {
  return (
    <div>
       <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Autohide</h4>
          <CodeModal>
            {`
    import { Datepicker } from "flowbite-react";
    import { IconCalendarMonth } from '@tabler/icons-react'

    <Datepicker autoHide={false} className="form-control" icon={() => <IconCalendarMonth size={20} />} />
              `}
          </CodeModal>
        </div>

        <Datepicker autoHide={false} className="form-control" icon={() => <IconCalendarMonth size={20} />} />
      </CardBox>
    </div>
  )
}

export default AutoHide
