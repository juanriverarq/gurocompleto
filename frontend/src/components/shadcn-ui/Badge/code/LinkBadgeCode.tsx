
import CodeModal from '../../CodeModal'

const LinkBadgeCode = () => {
  return (
    <CodeModal>
        {
            `
import { badgeVariants } from 'src/components/shadcn-ui/Default-Ui/badge'

<Link to="/ui-components/badge" className={badgeVariants({ variant: "default" })}>Badge Link 1</Link>
<Link to="/ui-components/badge" className={badgeVariants({ variant: "secondary" })}>Badge Link 2</Link>
<Link to="/ui-components/badge" className={badgeVariants({ variant: "success" })}>Badge Link 3</Link>
<Link to="/ui-components/badge" className={badgeVariants({ variant: "warning" })}>Badge Link 4</Link>
<Link to="/ui-components/badge" className={badgeVariants({ variant: "error" })}>Badge Link 5</Link>
<Link to="/ui-components/badge" className={badgeVariants({ variant: "info" })}>Badge Link 6</Link>            
            `
        }
    </CodeModal>
  )
}

export default LinkBadgeCode