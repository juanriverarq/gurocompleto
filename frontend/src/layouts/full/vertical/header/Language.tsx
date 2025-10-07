import { useContext, useEffect } from "react";
import { useTranslation } from 'react-i18next'
import { Dropdown } from "flowbite-react";
import { CustomizerContext } from "src/context/CustomizerContext";
import engFlag from "/src/assets/images/flag/icon-flag-en.svg"
import cnFlag from "/src/assets/images/flag/icon-flag-cn.svg"
import frFlag from "/src/assets/images/flag/icon-flag-fr.svg"
import saFlag from "/src/assets/images/flag/icon-flag-sa.svg"
// Agregar bandera de España
const esFlag = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iMTIiIGZpbGw9IiNGRkFBMDAiLz4KPHJlY3QgeT0iNiIgd2lkdGg9IjI0IiBoZWlnaHQ9IjEyIiBmaWxsPSIjRkY0NDQ0Ii8+Cjwvc3ZnPgo=";

const Languages = [
  {
    flagname: "Español (ES)",
    icon: esFlag,
    value: "es",
  },
  {
    flagname: "English (UK)",
    icon: engFlag,
    value: "en",
  },
  {
    flagname: "中国人 (Chinese)",
    icon: cnFlag,
    value: "ch",
  },
  {
    flagname: "français (French)",
    icon: frFlag,
    value: "fr",
  },
  {
    flagname: "عربي (Arabic)",
    icon: saFlag,
    value: "ar",
  },
];

export const Language = () => {
  const { i18n } = useTranslation();

  const {
    isLanguage, setIsLanguage
  } = useContext(CustomizerContext);
  
  // Por defecto usar español si no hay idioma configurado
  const currentLang =
    Languages.find((_lang) => _lang.value === isLanguage) || Languages[0];

  useEffect(() => {
    i18n.changeLanguage(isLanguage);
  }, [isLanguage, i18n]);

  const handleLanguageChange = (languageValue: string) => {
    setIsLanguage(languageValue);
    // Mostrar mensaje de confirmación
    const selectedLang = Languages.find(lang => lang.value === languageValue);
    if (selectedLang) {
    }
  };

  return (
    <>
      <div className="relative group/menu">
        <Dropdown
          label=""
          className="w-56 rounded-sm"
          dismissOnClick={false}
          renderTrigger={() => (
            <span className="h-8 w-8 hover:bg-lightprimary rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary">
              <img
                src={currentLang.icon}
                height={35}
                width={32}
                alt={`Idioma: ${currentLang.flagname}`}
                className="rounded-full h-5 w-5 object-cover cursor-pointer"
              />
            </span>
          )}
        >
          {Languages.map((item, index) => (
            <Dropdown.Item
              className={`flex gap-3 items-center py-3 w-full hover:bg-gray-50 dark:hover:bg-gray-800 ${
                currentLang.value === item.value ? 'bg-lightprimary text-primary' : ''
              }`}
              key={index}
              onClick={() => handleLanguageChange(item.value)}
            >
              <img
                src={item.icon}
                alt={`Bandera ${item.flagname}`}
                height={24}
                width={24}
                className="rounded-full object-cover h-6 w-6"
              />
              <span className="font-medium">{item.flagname}</span>
              {currentLang.value === item.value && (
                <span className="ml-auto text-primary text-sm">✓</span>
              )}
            </Dropdown.Item>
          ))}
        </Dropdown>
      </div>
    </>
  );
};

