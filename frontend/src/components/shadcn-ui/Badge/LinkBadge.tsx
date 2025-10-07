import { badgeVariants } from 'src/components/shadcn-ui/Default-Ui/badge'
import LinkBadgeCode from './code/LinkBadgeCode'
import CardBox from '../../shared/CardBox'
import { Link } from 'react-router'

const LinkBadge = () => {
  return (
    <>

    <CardBox>
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold">Badge as Link</h4>
                 <LinkBadgeCode/>
            </div>
            <div className="flex items-center flex-wrap gap-3 mt-4">
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "default" })}>Badge Link 1</Link>
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "secondary" })}>Badge Link 2</Link>
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "success" })}>Badge Link 3</Link>
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "warning" })}>Badge Link 4</Link>
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "error" })}>Badge Link 5</Link>
            <Link to="/ui-components/badge" className={badgeVariants({ variant: "info" })}>Badge Link 6</Link>
            </div>
        </CardBox>
    </>
  )
}

export default LinkBadge