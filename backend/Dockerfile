FROM php:8.3-fpm-bullseye

# Install system dependencies
RUN apt-get update \
    && apt-get install -y \
        git \
        curl \
        libpng-dev \
        libonig-dev \
        libxml2-dev \
        libzip-dev \
        zip \
        unzip \
        supervisor \
        default-mysql-client \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/*

# Install Node (for Vite) - optional, skip if not needed in container
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && npm i -g pnpm@9 npm@10 \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy only composer files first for better caching
COPY composer.json composer.lock ./
RUN composer install --no-scripts --no-interaction --prefer-dist --optimize-autoloader || true

# Copy project files
COPY . .

# PHP-FPM config tweaks (optional)
RUN echo "memory_limit=512M" > /usr/local/etc/php/conf.d/memory-limit.ini \
    && echo "upload_max_filesize=64M" > /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size=64M" > /usr/local/etc/php/conf.d/post-size.ini \
    && echo "max_execution_time=120" > /usr/local/etc/php/conf.d/max-exec-time.ini

CMD ["php-fpm"]


