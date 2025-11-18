import { uniqueId } from "lodash";

const Menuitems = [
  {
    id: uniqueId(),
    title: "Dashboard",
    icon: "solar:layers-line-duotone",
    href: "",
    children: [
      {
        title: "Dashboard1",
        icon: "solar:atom-line-duotone",
        id: uniqueId(),
        href: "/apps/",
      },
      {
        title: "Dashboard2",
        icon: "solar:chart-line-duotone",
        id: uniqueId(),
        href: "/apps/dashboards/dashboard2",
      },
      {
        title: "Dashboard3",
        icon: "solar:screencast-2-line-duotone",
        id: uniqueId(),
        href: "/apps/dashboards/dashboard3",
      },
      
      {
        title: "Landingpage",
        icon: "solar:bill-list-line-duotone",
        id: uniqueId(),
        href: "/",
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Apps",
    icon: "solar:widget-line-duotone",
    href: "",
    children: [
      {
        id: uniqueId(),
        title: "Contacts",
        icon: "solar:phone-line-duotone",
        href: "/apps/contacts",
      },
      {
        id: uniqueId(),
        title: "Chats",
        icon: "solar:chat-round-line-line-duotone",
        href: "/apps/chats",
      },
      {
        id: uniqueId(),
        title: "Notes",
        icon: "solar:document-text-line-duotone",
        href: "/apps/notes",
      },
      {
        id: uniqueId(),
        title: "Calendar",
        icon: "solar:calendar-mark-line-duotone",
        href: "/apps/calendar",
      },
      {
        id: uniqueId(),
        title: "Email",
        icon: "solar:letter-line-duotone",
        href: "/apps/email",
      },
      {
        id: uniqueId(),
        title: "Tickets",
        icon: "solar:ticker-star-outline",
        href: "/apps/tickets",
      },
      {
        id: uniqueId(),
        title: "Kanban",
        icon: "solar:notebook-linear",
        href: "/apps/kanban",
      },
      {
        id: uniqueId(),
        title: "User Profile",
        icon: "solar:shield-user-outline",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Profile",
            href: "/apps/user-profile/profile",
          },
          {
            id: uniqueId(),
            title: "Followers",
            href: "/apps/user-profile/followers",
          },
          {
            id: uniqueId(),
            title: "Friends",
            href: "/apps/user-profile/friends",
          },
          {
            id: uniqueId(),
            title: "Gallery",
            href: "/apps/user-profile/gallery",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Ecommerce",
        icon: "solar:document-text-line-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Shop",
            href: "/apps/ecommerce/shop",
          },
          {
            id: uniqueId(),
            title: "Details",
            href: "/apps/ecommerce/detail/3",
          },
          {
            id: uniqueId(),
            title: "List",
            href: "/apps/ecommerce/list",
          },
          {
            id: uniqueId(),
            title: "Checkout",
            href: "/apps/ecommerce/checkout",
          },
          {
            id: uniqueId(),
            title: "Add Product",
            href: "/apps/ecommerce/addproduct",
          },
          {
            id: uniqueId(),
            title: "Edit Product",
            href: "/apps/ecommerce/editproduct",
          },
        ],
      },
      {
        title: "Invoice",
        id: uniqueId(),
        icon: "solar:bill-check-outline",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "List",
            href: "/apps/invoice/list",
          },
          {
            id: uniqueId(),
            title: "Details",
            href: "/apps/invoice/detail/PineappleInc",
          },
          {
            id: uniqueId(),
            title: "Create",
            href: "/apps/invoice/create",
          },
          {
            id: uniqueId(),
            title: "Edit",
            href: "/apps/invoice/edit/PineappleInc",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Blogs",
        icon: "solar:widget-add-line-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Blog Post",
            href: "/apps/blog/post",
          },
          {
            id: uniqueId(),
            title: "Blog Detail",
            href: "/apps/blog/detail/streaming-video-way-before-it-was-cool-go-dark-tomorrow",
          },
        ],
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Marketing",
    icon: "solar:megaphone-loud-line-duotone",
    href: "",
    children: [
      {
        id: uniqueId(),
        title: "Enlaces",
        icon: "solar:link-bold-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Crear Enlaces",
            href: "/apps/marketing/enlaces-cotizacion",
          },
          {
            id: uniqueId(),
            title: "Gestionar Enlaces",
            href: "/apps/marketing/enlaces-cotizacion",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Email Marketing",
        icon: "solar:letter-bold-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Recordatorios",
            href: "/apps/marketing/recordatorios",
          },
          {
            id: uniqueId(),
            title: "Campañas",
            href: "/apps/email",
          },
          {
            id: uniqueId(),
            title: "Templates",
            href: "/apps/ui-components/collapse",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Leads",
        icon: "solar:target-bold-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Lista de Leads",
            href: "/apps/ui-components/dialog",
          },
          {
            id: uniqueId(),
            title: "Calificación",
            href: "/apps/ui-components/drawer",
          },
          {
            id: uniqueId(),
            title: "Conversiones",
            href: "/apps/ui-components/dropdown",
          },
        ],
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Administración",
    icon: "solar:settings-bold-duotone",
    href: "",
    children: [
      {
        id: uniqueId(),
        title: "Configuración Agencia",
        icon: "solar:settings-bold-duotone",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Usuarios",
            href: "/apps/admin/usuarios",
          },
          {
            id: uniqueId(),
            title: "Información de agencia",
            href: "/apps/admin/informacion-agencia",
          },
          {
            id: uniqueId(),
            title: "Sedes",
            href: "/apps/admin/sedes",
          },
          {
            id: uniqueId(),
            title: "Aseguradoras",
            href: "/apps/admin/aseguradoras",
          },
          {
            id: uniqueId(),
            title: "Ramos",
            href: "/apps/admin/ramos",
          },
          {
            id: uniqueId(),
            title: "Vendedores",
            href: "/apps/admin/vendedores",
          },
          {
            id: uniqueId(),
            title: "Estados Siniestros",
            href: "/apps/admin/estados-siniestros",
          },
          {
            id: uniqueId(),
            title: "Estados ARL",
            href: "/apps/admin/estados-arl",
          },
          {
            id: uniqueId(),
            title: "Motivos estados póliza",
            href: "/apps/admin/motivos-estados-poliza",
          },
          {
            id: uniqueId(),
            title: "Tipo afiliación",
            href: "/apps/admin/tipo-afiliacion",
          },
          {
            id: uniqueId(),
            title: "Mensajeros",
            href: "/apps/admin/mensajeros",
          },
          {
            id: uniqueId(),
            title: "Coberturas",
            href: "/apps/admin/coberturas",
          },
        ],
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Ui Elements",
    icon: "solar:palette-round-line-duotone",
    column: 4,
    href: "",
    children: [
      {
        id: uniqueId(),
        title: "Accordion",
        icon: "solar:waterdrops-line-duotone",
        href: "/apps/ui-components/accordion",
      },
      {
        id: uniqueId(),
        title: "Badge",
        icon: "solar:tag-horizontal-line-duotone",
        href: "/apps/ui-components/badge",
      },
      {
        id: uniqueId(),
        title: "Button",
        icon: "solar:airbuds-case-minimalistic-line-duotone",
        href: "/apps/ui-components/buttons",
      },
      {
        id: uniqueId(),
        title: "Dropdowns",
        icon: "solar:airbuds-case-line-duotone",
        href: "/apps/ui-components/dropdown",
      },
      {
        id: uniqueId(),
        title: "Modals",
        icon: "solar:bolt-line-duotone",
        href: "/apps/ui-components/modals",
      },
      {
        id: uniqueId(),
        title: "Tab",
        icon: "solar:box-minimalistic-line-duotone",
        href: "/apps/ui-components/tab",
      },
      {
        id: uniqueId(),
        title: "Tooltip",
        icon: "solar:feed-line-duotone",
        href: "/apps/ui-components/tooltip",
      },
      {
        id: uniqueId(),
        title: "Alert",
        icon: "solar:flag-line-duotone",
        href: "/apps/ui-components/alert",
      },
      {
        id: uniqueId(),
        title: "Progressbar",
        icon: "solar:programming-line-duotone",
        href: "/apps/ui-components/progressbar",
      },
      {
        id: uniqueId(),
        title: "Pagination",
        icon: "solar:waterdrops-line-duotone",
        href: "/apps/ui-components/pagination",
      },
      {
        id: uniqueId(),
        title: "Breadcrumbs",
        icon: "solar:slider-minimalistic-horizontal-line-duotone",
        href: "/apps/ui-components/breadcrumb",
      },
      {
        id: uniqueId(),
        title: "Drawer",
        icon: "solar:laptop-minimalistic-line-duotone",
        href: "/apps/ui-components/drawer",
      },
      {
        id: uniqueId(),
        title: "Lists",
        icon: "solar:checklist-bold-duotone",
        href: "/apps/ui-components/listgroup",
      },
      {
        id: uniqueId(),
        title: "Carousel",
        icon: "solar:align-horizonta-spacing-line-duotone",
        href: "/apps/ui-components/carousel",
      },
      {
        id: uniqueId(),
        title: "Spinner",
        icon: "solar:soundwave-bold-duotone",
        href: "/apps/ui-components/spinner",
      },
      {
        id: uniqueId(),
        title: "Avatar",
        icon: "solar:user-line-duotone",
        href: "/apps/ui-components/avatar",
      },
      {
        id: uniqueId(),
        title: "Banner",
        icon: "solar:banknote-linear",
        href: "/apps/ui-components/banner",
      },
      {
        id: uniqueId(),
        title: "Button Group",
        icon: "solar:users-group-two-rounded-outline",
        href: "/apps/ui-components/button-group",
      },
      {
        id: uniqueId(),
        title: "Card",
        icon: "solar:card-line-duotone",
        href: "/apps/ui-components/card",
      },
      {
        id: uniqueId(),
        title: "Datepicker",
        icon: "solar:calendar-search-linear",
        href: "/apps/ui-components/datepicker",
      },
      {
        id: uniqueId(),
        title: "Footer",
        icon: "solar:wad-of-money-outline",
        href: "/apps/ui-components/footer",
      },
      {
        id: uniqueId(),
        title: "KBD",
        icon: "solar:keyboard-line-duotone",
        href: "/apps/ui-components/kbd",
      },
      {
        id: uniqueId(),
        title: "Mega Menu",
        icon: "solar:clipboard-list-linear",
        href: "/apps/ui-components/megamenu",
      },
      {
        id: uniqueId(),
        title: "Navbar",
        icon: "solar:slider-minimalistic-horizontal-linear",
        href: "/apps/ui-components/navbar",
      },
      {
        id: uniqueId(),
        title: "Popover",
        icon: "solar:chat-line-line-duotone",
        href: "/apps/ui-components/popover",
      },
      {
        id: uniqueId(),
        title: "Rating",
        icon: "solar:stars-linear",
        href: "/apps/ui-components/rating",
      },
      {
        id: uniqueId(),
        title: "Sidebar",
        icon: "solar:siderbar-broken",
        href: "/apps/ui-components/sidebar",
      },
      {
        id: uniqueId(),
        title: "Tables",
        icon: "solar:bedside-table-linear",
        href: "/apps/ui-components/tables",
      },
      {
        id: uniqueId(),
        title: "Timeline",
        icon: "solar:align-horizontal-center-outline",
        href: "/apps/ui-components/timeline",
      },
      {
        id: uniqueId(),
        title: "Toast",
        icon: "solar:check-square-linear",
        href: "/apps/ui-components/toast",
      },
      {
        id: uniqueId(),
        title: "Typography",
        icon: "solar:text-bold-duotone",
        href: "/apps/ui-components/typography",
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Headless UI",
    column: 4,
    icon: "solar:text-underline-cross-broken",
    href: "",
    children: [
      {
        title: "Dropdown",
        icon: "solar:round-alt-arrow-down-outline",
        id: uniqueId(),
        href: "/apps/headless-ui/dropdown",
      },
      {
        title: "Disclosure",
        icon: "solar:accumulator-broken",
        id: uniqueId(),
        href: "/apps/headless-ui/disclosure",
      },
      {
        title: "Dialog",
        icon: "solar:smartphone-update-line-duotone",
        id: uniqueId(),
        href: "/apps/headless-ui/dialog",
      },
      {
        title: "Popover",
        icon: "solar:airbuds-case-charge-line-duotone",
        id: uniqueId(),
        href: "/apps/headless-ui/popover",
      },
      {
        title: "Tabs",
        icon: "solar:clapperboard-text-linear",
        id: uniqueId(),
        href: "/apps/headless-ui/tabs",
      },
      {
        title: "Transition",
        icon: "solar:round-transfer-horizontal-line-duotone",
        id: uniqueId(),
        href: "/apps/headless-ui/transition",
      },

      {
        id: uniqueId(),
        title: "Buttons",
        icon: "solar:adhesive-plaster-outline",
        href: "/apps/headless-form/buttons",
      },
      {
        id: uniqueId(),
        title: "Checkbox",
        icon: "solar:check-circle-linear",
        href: "/apps/headless-form/checkbox",
      },
      {
        id: uniqueId(),
        title: "Combobox",
        icon: "solar:archive-down-minimlistic-broken",
        href: "/apps/headless-form/combobox",
      },
      {
        id: uniqueId(),
        title: "Fieldset",
        icon: "solar:password-minimalistic-input-outline",
        href: "/apps/headless-form/fieldset",
      },
      {
        id: uniqueId(),
        title: "Input",
        icon: "solar:text-italic-circle-linear",
        href: "/apps/headless-form/input",
      },
      {
        id: uniqueId(),
        title: "Listbox",
        icon: "solar:list-check-linear",
        href: "/apps/headless-form/listbox",
      },
      {
        id: uniqueId(),
        title: "Radio Group",
        icon: "solar:round-graph-linear",
        href: "/apps/headless-form/radiogroup",
      },
      {
        id: uniqueId(),
        title: "Select",
        icon: "solar:minimize-square-3-outline",
        href: "/apps/headless-form/select",
      },
      {
        id: uniqueId(),
        title: "Switch",
        icon: "solar:branching-paths-down-outline",
        href: "/apps/headless-form/switch",
      },
      {
        id: uniqueId(),
        title: "Textarea",
        icon: "solar:text-square-2-linear",
        href: "/apps/headless-form/textarea",
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Shadcn UI",
    column: 4,
    icon: "solar:command-broken",
            href: "/apps/shadcn/",
    children: [
      {
        title: "Accordion",
        icon: "solar:round-alt-arrow-down-outline",
        id: uniqueId(),
        href: "/apps/shadcn-ui/accordion",
      },
      {
        id: uniqueId(),
        title: "Badge",
        icon: "solar:tag-horizontal-line-duotone",
        href: "/apps/shadcn-ui/badge",
      },
      {
        id: uniqueId(),
        title: "Button",
        icon: "solar:airbuds-case-minimalistic-line-duotone",
        href: "/apps/shadcn-ui/buttons",
      },
      {
        id: uniqueId(),
        title: "Dropdowns",
        icon: "solar:airbuds-case-line-duotone",
        href: "/apps/shadcn-ui/dropdown",
      },
      {
        id: uniqueId(),
        title: "Dialogs",
        icon: "solar:bolt-line-duotone",
        href: "/apps/shadcn-ui/dialogs",
      },
      {
        id: uniqueId(),
        title: "Tab",
        icon: "solar:box-minimalistic-line-duotone",
        href: "/apps/shadcn-ui/tab",
      },
      {
        id: uniqueId(),
        title: "Tooltip",
        icon: "solar:feed-line-duotone",
        href: "/apps/shadcn-ui/tooltip",
      },
      {
        id: uniqueId(),
        title: "Alert",
        icon: "solar:flag-line-duotone",
        href: "/apps/shadcn-ui/alert",
      },
      {
        id: uniqueId(),
        title: "Progressbar",
        icon: "solar:programming-line-duotone",
        href: "/apps/shadcn-ui/progressbar",
      },
      {
        id: uniqueId(),
        title: "Breadcrumbs",
        icon: "solar:slider-minimalistic-horizontal-line-duotone",
        href: "/apps/shadcn-ui/breadcrumb",
      },
      {
        id: uniqueId(),
        title: "Drawer",
        icon: "solar:laptop-minimalistic-line-duotone",
        href: "/apps/shadcn-ui/drawer",
      },
      {
        id: uniqueId(),
        title: "Carousel",
        icon: "solar:align-horizonta-spacing-line-duotone",
        href: "/apps/shadcn-ui/carousel",
      },
      {
        id: uniqueId(),
        title: "Skeleton",
        icon: "solar:soundwave-bold-duotone",
        href: "/apps/shadcn-ui/skeleton",
      },
      {
        id: uniqueId(),
        title: "Avatar",
        icon: "solar:user-line-duotone",
        href: "/apps/shadcn-ui/avatar",
      },
      {
        id: uniqueId(),
        title: "Card",
        icon: "solar:card-line-duotone",
        href: "/apps/shadcn-ui/card",
      },
      {
        id: uniqueId(),
        title: "Datepicker",
        icon: "solar:calendar-search-linear",
        href: "/apps/shadcn-ui/datepicker",
      },
      {
        id: uniqueId(),
        title: "Combobox",
        icon: "solar:wad-of-money-outline",
        href: "/apps/shadcn-ui/combobox",
      },
      {
        id: uniqueId(),
        title: "Collapsible",
        icon: "solar:list-up-minimalistic-bold-duotone",
        href: "/apps/shadcn-ui/collapsible",
      },
      {
        id: uniqueId(),
        title: "Command",
        icon: "solar:command-outline",
        href: "/apps/shadcn-ui/command",
      },
      {
        id: uniqueId(),
        title: "Toast",
        icon: "solar:notification-unread-broken",
        href: "/apps/shadcn-ui/toast",
      },
      {
        id: uniqueId(),
        title: "Input",
        icon: "solar:text-circle-linear",
        href: "/apps/shadcn-form/input",
      },
      {
        id: uniqueId(),
        title: "Select",
        icon: "solar:round-alt-arrow-down-outline",
        href: "/apps/shadcn-form/select",
      },
      {
        id: uniqueId(),
        title: "Checkbox",
        icon: "solar:shield-check-linear",
        href: "/apps/shadcn-form/checkbox",
      },
      {
        id: uniqueId(),
        title: "Radio",
        icon: "solar:record-linear",
        href: "/apps/shadcn-form/radio",
      },
    ],
  },

  {
    id: uniqueId(),
    title: "Pages",
    icon: "solar:book-outline",
    href: "",
    children: [
      {
        title: "Account Setting",
        icon: "solar:settings-minimalistic-line-duotone",
        id: uniqueId(),
        href: "/apps/theme-pages/account-settings",
      },
      {
        title: "FAQ",
        icon: "solar:question-circle-line-duotone",
        id: uniqueId(),
        href: "/apps/ayuda/faq",
      },
      {
        title: "Pricing",
        icon: "solar:dollar-minimalistic-linear",
        id: uniqueId(),
        href: "/apps/theme-pages/pricing",
      },
      {
        title: "Roll Base Access",
        icon: "solar:accessibility-broken",
        id: uniqueId(),
        href: "/apps/theme-pages/casl",
      },
      {
        id: uniqueId(),
        title: "Widgets",
        icon: "solar:adhesive-plaster-outline",
        href: "/apps/widgets/cards",
        children: [
          {
            id: uniqueId(),
            title: "Cards",
            href: "/apps/widgets/cards",
          },
          {
            id: uniqueId(),
            title: "Banners",
            href: "/apps/widgets/banners",
          },
          {
            id: uniqueId(),
            title: "Charts",
            href: "/apps/widgets/charts",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Auth",
        icon: "solar:lock-password-linear",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Login",
            icon: "solar:key-square-line-duotone",
            href: "",
            children: [
              {
                id: uniqueId(),
                title: "Side Login",

                href: "/auth/auth1/login",
              },
              {
                id: uniqueId(),
                title: "Boxed Login",

                href: "/auth/auth2/login",
              },
            ],
          },
          {
            id: uniqueId(),
            title: "Register",
            icon: "solar:user-check-rounded-broken",
            href: "",
            children: [
              {
                id: uniqueId(),
                title: "Side Register",

                href: "/auth/auth1/register",
              },
              {
                id: uniqueId(),
                title: "Boxed Register",

                href: "/auth/auth2/register",
              },
            ],
          },
          {
            id: uniqueId(),
            title: "Forgot Password",
            icon: "solar:shield-cross-broken",
            href: "",
            children: [
              {
                id: uniqueId(),
                title: "Side Forgot Pwd",

                href: "/auth/auth1/forgot-password",
              },
              {
                id: uniqueId(),
                title: "Boxed Forgot Pwd",

                href: "/auth/auth2/forgot-password",
              },
            ],
          },
          {
            id: uniqueId(),
            title: "Two Steps",
            icon: "solar:password-minimalistic-input-outline",
            href: "",
            children: [
              {
                id: uniqueId(),
                title: "Side Two Steps",

                href: "/auth/auth1/two-steps",
              },
              {
                id: uniqueId(),
                title: "Boxed Two Steps",

                href: "/auth/auth2/two-steps",
              },
            ],
          },
          {
            id: uniqueId(),
            title: "Others",
            icon: "solar:folder-error-linear",
            href: "",
            children: [
              {
                id: uniqueId(),
                title: "Error",
                href: "/auth/error",
              },
              {
                id: uniqueId(),
                title: "Maintenance",
                href: "/auth/maintenance",
              },
            ],
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Icons",
        icon: "solar:adhesive-plaster-outline",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Solar Icons",
            href: "/apps/icons/solar",
          },
          {
            id: uniqueId(),
            title: "Tabler Icons",
            href: "/apps/icons/tabler",
          },
        ],
      },
      {
        id: uniqueId(),
        title: "Charts",
        icon: "solar:chart-2-outline",
        href: "",
        children: [
          {
            title: "Line Chart",
            icon: "solar:chart-square-line-duotone",
            id: uniqueId(),
            href: "/apps/charts/line",
          },
          {
            title: "Area Chart",
            icon: "solar:graph-new-broken",
            id: uniqueId(),
            href: "/apps/charts/area",
          },
          {
            title: "Gradient Chart",
            icon: "solar:round-graph-outline",
            id: uniqueId(),
            href: "/apps/charts/gradient",
          },
          {
            title: "Candlestick",
            icon: "solar:chandelier-outline",
            id: uniqueId(),
            href: "/apps/charts/candlestick",
          },
          {
            title: "Column",
            icon: "solar:chart-2-bold-duotone",
            id: uniqueId(),
            href: "/apps/charts/column",
          },
          {
            title: "Doughnut & Pie",
            icon: "solar:pie-chart-2-linear",
            id: uniqueId(),
            href: "/apps/charts/doughnut",
          },
          {
            title: "Radialbar & Radar",
            icon: "solar:graph-line-duotone",
            id: uniqueId(),
            href: "/apps/charts/radialbar",
          },
        ],
      },
    
    ],
  },
  {
    id: uniqueId(),
    title: "Forms",
    icon: "solar:file-text-linear",
    href: "",
    children: [
      {
        id: uniqueId(),
        title: "Forms Elements",
        icon: "solar:text-selection-line-duotone",
        href: "/apps/forms/form-elements",
      },
      {
        id: uniqueId(),
        title: "Forms Layouts",
        icon: "solar:document-text-outline",
        href: "/apps/forms/form-layouts",
      },
      {
        id: uniqueId(),
        title: "Forms Horizontal",
        icon: "solar:slider-horizontal-line-duotone",
        href: "/apps/forms/form-horizontal",
      },
      {
        id: uniqueId(),
        title: "Forms Vertical",
        icon: "solar:slider-vertical-line-duotone",
        href: "/apps/forms/form-vertical",
      },
      {
        id: uniqueId(),
        title: "Forms Custom",
        icon: "solar:document-text-outline",
        href: "/apps/forms/form-custom",
      },
      {
        id: uniqueId(),
        title: "Form Validation",
        icon: "solar:bill-check-linear",
        href: "/apps/forms/form-validation",
      },
    ],
  },


  {
    id: uniqueId(),
    title: "Tables",
    icon: "solar:tuning-square-2-line-duotone",
    href: "",
    children: [
      {
        title: "Basic Tables",
        icon: "solar:tablet-line-duotone",
        id: uniqueId(),
        href: "/apps/tables/basic",
      },
      {
        title: "Striped Rows Table",
        icon: "solar:tablet-line-duotone",
        id: uniqueId(),
        href: "/apps/tables/striped-row",
      },
      {
        title: "Hover Table",
        icon: "solar:tablet-line-duotone",
        id: uniqueId(),
        href: "/apps/tables/hover-table",
      },
      {
        title: "Checkbox Table",
        icon: "solar:tablet-line-duotone",
        id: uniqueId(),
        href: "/apps/tables/checkbox-table",
      },
      {
        id: uniqueId(),
        title: "React Tables",
        icon: "solar:calendar-add-broken",
        href: "",
        children: [
          {
            id: uniqueId(),
            title: "Basic",
            href: "/apps/react-tables/basic",
          },
          {
            id: uniqueId(),
            title: "Dense",
            href: "/apps/react-tables/dense",
          },
          {
            id: uniqueId(),
            title: "Sorting",
            href: "/apps/react-tables/sorting",
          },
          {
            id: uniqueId(),
            title: "Filtering",
            href: "/apps/react-tables/filtering",
          },
          {
            id: uniqueId(),
            title: "Pagination",
            href: "/apps/react-tables/pagination",
          },
          {
            id: uniqueId(),
            title: "Row Selection",
            href: "/apps/react-tables/row-selection",
          },
          {
            id: uniqueId(),
            title: "Column Visibility",
            href: "/apps/react-tables/column-visibility",
          },
          {
            id: uniqueId(),
            title: "Editable",
            href: "/apps/react-tables/editable",
          },
          {
            id: uniqueId(),
            title: "Sticky",
            href: "/apps/react-tables/sticky",
          },
          {
            id: uniqueId(),
            title: "Drag & Drop",
            href: "/apps/react-tables/drag-drop",
          },
          {
            id: uniqueId(),
            title: "Empty",
            href: "/apps/react-tables/empty",
          },
          {
            id: uniqueId(),
            title: "Expanding",
            href: "/apps/react-tables/expanding",
          },
        ],
      },
    ],
  },
];
export default Menuitems;
