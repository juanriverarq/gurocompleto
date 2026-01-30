import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/shadcn-ui/Default-Ui/card';
import { Button } from '../../components/shadcn-ui/Default-Ui/button';
import { Input } from '../../components/shadcn-ui/Default-Ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/shadcn-ui/Default-Ui/select';
import { Icon as IconifyIcon } from '@iconify/react';
import masterPanelService from '../../services/masterPanelService';

interface LogFile {
  name: string;
  size: number;
  modified: string;
}

const MasterLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [availableFiles, setAvailableFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState('laravel');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState(500);
  const [loading, setLoading] = useState(true);
  const [totalLines, setTotalLines] = useState(0);
  const [showingLines, setShowingLines] = useState(0);

  useEffect(() => {
    loadLogs();
  }, [selectedFile, lines]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await masterPanelService.getLogs({
        file: selectedFile,
        lines,
        search,
      });
      if (response.success) {
        setLogs(response.data.lines || []);
        setAvailableFiles(response.data.available_files || []);
        setTotalLines(response.data.total_lines || 0);
        setShowingLines(response.data.showing_lines || 0);
      }
    } catch (error: any) {
      console.error('Error loading logs:', error);
      if (error.response?.data?.available_files) {
        setAvailableFiles(error.response.data.available_files.map((f: string) => ({ name: f, size: 0, modified: '' })));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadLogs();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getLogLevel = (line: string): string => {
    if (line.includes('.ERROR') || line.includes('error') || line.includes('ERROR')) return 'error';
    if (line.includes('.WARNING') || line.includes('warning') || line.includes('WARNING')) return 'warning';
    if (line.includes('.INFO') || line.includes('info') || line.includes('INFO')) return 'info';
    if (line.includes('.DEBUG') || line.includes('debug') || line.includes('DEBUG')) return 'debug';
    return 'default';
  };

  const getLogLevelStyle = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-500';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500';
      case 'debug': return 'bg-gray-50 dark:bg-gray-800 border-l-4 border-l-gray-400';
      default: return 'bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <IconifyIcon icon="solar:document-text-bold-duotone" className="text-gray-600" />
            Logs del Sistema
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visor de logs del backend en tiempo real
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs}>
          <IconifyIcon icon="solar:refresh-linear" className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-48">
              <Select value={selectedFile} onValueChange={setSelectedFile}>
                <SelectTrigger>
                  <SelectValue placeholder="Archivo de log" />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles.map((file) => (
                    <SelectItem key={file.name} value={file.name}>
                      {file.name}.log
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-32">
              <Select value={lines.toString()} onValueChange={(v) => setLines(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="Líneas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 líneas</SelectItem>
                  <SelectItem value="250">250 líneas</SelectItem>
                  <SelectItem value="500">500 líneas</SelectItem>
                  <SelectItem value="1000">1000 líneas</SelectItem>
                  <SelectItem value="2000">2000 líneas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <IconifyIcon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Buscar en logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch}>
                  <IconifyIcon icon="solar:magnifer-linear" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {availableFiles.map((file) => (
          <Card 
            key={file.name} 
            className={`cursor-pointer transition-all ${selectedFile === file.name ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setSelectedFile(file.name)}
          >
            <CardContent className="pt-4 text-center">
              <IconifyIcon 
                icon="solar:document-text-bold-duotone" 
                className={`w-8 h-8 mx-auto mb-2 ${selectedFile === file.name ? 'text-primary' : 'text-gray-400'}`} 
              />
              <p className="font-medium text-sm truncate">{file.name}.log</p>
              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>Archivo: <strong>{selectedFile}.log</strong></span>
        <span>•</span>
        <span>Total: <strong>{totalLines.toLocaleString()}</strong> líneas</span>
        <span>•</span>
        <span>Mostrando: <strong>{showingLines.toLocaleString()}</strong> líneas</span>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconifyIcon icon="solar:code-bold-duotone" className="w-5 h-5 text-gray-600" />
            Contenido del Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <IconifyIcon icon="solar:document-text-linear" className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No se encontraron logs</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto font-mono text-xs">
              {logs.map((line, index) => {
                const level = getLogLevel(line);
                return (
                  <div 
                    key={index} 
                    className={`px-4 py-1.5 border-b border-gray-100 dark:border-gray-800 ${getLogLevelStyle(level)}`}
                  >
                    <pre className="whitespace-pre-wrap break-all">{line}</pre>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-500 rounded"></span>
          Error
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-yellow-500 rounded"></span>
          Warning
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-500 rounded"></span>
          Info
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 bg-gray-400 rounded"></span>
          Debug
        </span>
      </div>
    </div>
  );
};

export default MasterLogsPage;
