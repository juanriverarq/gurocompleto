
import CodeModal from 'src/components/shadcn-ui/CodeModal'


const DafaultTextareacode = () => {
  return (
    <>
      <CodeModal>
        {`  
import { Textarea } from "src/components/shadcn-ui/Default-Ui/textarea";

 <Textarea placeholder="Type your message here." />
                `}
      </CodeModal>
    </>
  )
}

export default DafaultTextareacode