import { Modal, TextInput } from "flowbite-react";
import { useState } from "react";
import { Icon } from "@iconify/react";
import * as SearchData from "./Data";
import { Link, useNavigate } from "react-router";

const Search = () => {
  const [openModal, setOpenModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredResults, setFilteredResults] = useState(SearchData.SearchLinks);
  const navigate = useNavigate();

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.trim() === "") {
      setFilteredResults(SearchData.SearchLinks);
    } else {
      const filtered = SearchData.SearchLinks.filter(link =>
        link.title.toLowerCase().includes(value.toLowerCase()) ||
        link.href.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredResults(filtered);
    }
  };

  const handleResultClick = (href: string) => {
    setOpenModal(false);
    setSearchTerm("");
    setFilteredResults(SearchData.SearchLinks);
    navigate(href);
  };

  const handleModalClose = () => {
    setOpenModal(false);
    setSearchTerm("");
    setFilteredResults(SearchData.SearchLinks);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredResults.length > 0) {
      handleResultClick(filteredResults[0].href);
    }
  };

  return (
    <div>
      <button
        onClick={() => setOpenModal(true)}
        className="h-10 w-10 text-darklink dark:text-white text-sm hover:text-primary hover:bg-lightprimary dark:hover:text-primary dark:hover:bg-darkminisidebar rounded-full flex justify-center items-center cursor-pointer"
        title="Buscar"
      >
        <Icon icon="solar:magnifer-line-duotone" height={20} />
      </button>

      <Modal dismissible show={openModal} onClose={handleModalClose} size="lg">
        <div className="p-6 border-b border-ld">
          <div className="relative">
            <TextInput
              placeholder="Buscar páginas, funciones, configuraciones..."
              className="form-control"
              sizing="md"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              required
            />
            <Icon
              icon="solar:magnifer-line-duotone"
              height={20}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
          </div>
        </div>
        <Modal.Body className="pt-0">
          <div className="max-h-72 overflow-y-auto">
            {searchTerm && (
              <div className="pt-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''} para "{searchTerm}"
                </p>
              </div>
            )}
            
            <h5 className="text-lg pt-5 mb-3 font-semibold">Enlaces Rápidos</h5>
            
            {filteredResults.length > 0 ? (
              filteredResults.map((links, index) => (
                <div
                  key={index}
                  onClick={() => handleResultClick(links.href)}
                  className="py-3 px-3 group relative hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-lightprimary rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon
                        icon="solar:document-bold-duotone"
                        height={16}
                        className="text-primary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h6 className="group-hover:text-primary mb-1 font-medium text-sm truncate">
                        {links.title}
                      </h6>
                      <p className="text-xs text-bodytext truncate">
                        {links.href}
                      </p>
                    </div>
                    <Icon
                      icon="solar:arrow-right-line-duotone"
                      height={16}
                      className="text-gray-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <Icon
                  icon="solar:magnifer-bug-bold-duotone"
                  height={48}
                  className="text-gray-400 mx-auto mb-3"
                />
                <p className="text-gray-500">No se encontraron resultados para "{searchTerm}"</p>
                <p className="text-sm text-gray-400 mt-1">Intenta con otros términos de búsqueda</p>
              </div>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Search;
