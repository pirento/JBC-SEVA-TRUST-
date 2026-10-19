# JBC Seva Trust website: deploy karne ki guide

Website ka data files mein rehta hai, isliye use aisi disk chahiye jo restart par mite nahi. Sabse aasaan aur sasta raasta ek chhota Linux server (VPS) hai. Render ka free plan ya Vercel jaisi hosting par ye website nahi chalegi, wahan data mit jaata hai.

## Kya chahiye

- **Domain**, jaise `jbcsevatrust.org` (GoDaddy, Hostinger ya BigRock se, lagbhag ₹800–1,200 saal ka)
- **VPS**: Ubuntu 24.04, 1 GB RAM, Mumbai ya Bangalore region (DigitalOcean, Hostinger VPS ya AWS Lightsail, lagbhag ₹500–800 mahina). Ho sake to backup ke liye ek alag disk (volume) bhi jod lein.
- **PayU live account** (KYC ke baad)
- **Gmail app password** `jbcsevatrust@gmail.com` ke liye

## Step 1: Domain ko server se jodein

Domain ki DNS settings mein do **A record** banayein, `@` aur `www`, dono server ke IP address par. Ise lagu hone mein kuch minute se kuch ghante lagte hain.

## Step 2: Server par software lagayein

Server mein SSH se login karke ye chalayein:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx
sudo npm install -g pm2
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## Step 3: Code laayein

```bash
sudo mkdir -p /var/www/jbc /srv/jbc-data /srv/jbc-backups
sudo chown -R $USER /var/www/jbc /srv/jbc-data /srv/jbc-backups
git clone -b main https://github.com/pirento/JBC-SEVA-TRUST-.git /var/www/jbc
cd /var/www/jbc
npm ci --omit=dev
```

Repo private hai to clone par GitHub username aur ek **Personal Access Token** maangega (GitHub → Settings → Developer settings → Tokens). Password wahan kaam nahi karta.

Alag backup disk lagayi hai to `/srv/jbc-backups` ki jagah us disk ka folder use karein.

## Step 4: Secret keys banayein

```bash
# DATA_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# ADMIN_PASSWORD_HASH
npm run hash-password -- "yahan-admin-ka-mazboot-password"
```

**Dhyan dein:** `DATA_ENCRYPTION_KEY` ko server ke bahar bhi kahin surakshit rakhein, jaise password manager ya likh kar trustee ke paas. Ye key kho gayi to saara data aur saare backup hamesha ke liye padhne layak nahi rahenge.

## Step 5: Gmail app password

1. `jbcsevatrust@gmail.com` se login karein.
2. Google Account → Security mein **2-Step Verification** chalu karein.
3. Security → **App passwords** mein naya password banayein. Ye 16 akshar ka hota hai.

## Step 6: `.env` file bharein

`nano /var/www/jbc/.env` kholein aur ye bharein (apne domain aur keys ke saath):

```
NODE_ENV=production
PORT=3000
APP_URL=https://jbcsevatrust.org
DATA_DIR=/srv/jbc-data
BACKUP_DIR=/srv/jbc-backups
TRUST_PROXY=1

SESSION_SECRET=<step 4 wala>
DATA_ENCRYPTION_KEY=<step 4 wala>
ADMIN_PASSWORD_HASH=<step 4 wala>

EMAIL_USER=jbcsevatrust@gmail.com
EMAIL_PASS=<16 akshar ka app password, bina space>

PAYU_ENV=production
PAYU_KEY=<PayU live key>
PAYU_SALT=<PayU live salt>
PAYU_SUCCESS_URL=https://jbcsevatrust.org/donation/success
PAYU_FAILURE_URL=https://jbcsevatrust.org/donation/failure
PAYU_DONATION_SUCCESS_URL=https://jbcsevatrust.org/donate/success
PAYU_DONATION_FAILURE_URL=https://jbcsevatrust.org/donate/failure
```

Pehli baar jaanch ke liye PayU ki **test** keys aur `PAYU_ENV=test` rakh sakte hain. Sab theek chale to live keys daal dein.

## Step 7: Website chalu karein

```bash
cd /var/www/jbc
pm2 start app.js --name jbc
pm2 save
pm2 startup        # ye ek command dikhayega, use copy karke chalayein
pm2 logs jbc       # dekhein: "Go-live checklist" mein kuch bacha to wahi likha aayega
```

Server reboot hone par bhi pm2 website apne aap chalu kar dega.

## Step 8: Nginx aur HTTPS

`sudo nano /etc/nginx/sites-available/jbc` mein ye likhein:

```nginx
server {
    server_name jbcsevatrust.org www.jbcsevatrust.org;
    client_max_body_size 6m;   # 5 MB tak ki photo upload ke liye

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Phir ye chalayein:

```bash
sudo ln -s /etc/nginx/sites-available/jbc /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d jbcsevatrust.org -d www.jbcsevatrust.org
```

Certbot muft HTTPS certificate lagata hai aur use apne aap renew bhi karta hai.

## Step 9: PayU dashboard

- PayU Dashboard → Developers → **Webhooks** mein `https://jbcsevatrust.org/payu/webhook` jodein, **Successful payment** event ke liye.
- Agar PayU website ka address maange to apna domain daalein.

## Step 10: Aakhri jaanch

1. Website kholein. Hindi button, WhatsApp button aur footer ka number check karein.
2. Ek account banayein. Confirm karne ka email aana chahiye.
3. `/admin/login` par admin password se login karein.
4. **₹100 ka ek asli daan** karein. Thank-you page, rasid ka email, certificate download aur admin dashboard, chaaron check karein.
5. Backup chala kar dekhein: `cd /var/www/jbc && npm run backup && ls /srv/jbc-backups`

## Baad mein code update karna

```bash
cd /var/www/jbc && git pull && npm ci --omit=dev && pm2 restart jbc
```

Restart par logged-in log ek baar logout ho jaate hain. Data par koi asar nahi padta.

## Yaad rakhein

- Cloudflare lagayenge to `.env` mein `TRUST_PROXY=2` karein.
- `.env` aur `DATA_ENCRYPTION_KEY` kabhi GitHub par na daalein. `.env` pehle se gitignore mein hai.
- Backup restore karna ho to kisi ek din ka backup folder `DATA_DIR` mein wapas copy kar dein.
