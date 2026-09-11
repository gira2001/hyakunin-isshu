# 環境構築　　
## Javaのインストール　　
### Javaのバージョン確認　　

Javaのバージョンを確認コマンド（23やと動くはず。他はわからん）

```sh
java -version
```
## postgresのインストール　　
### postgresをmacにインストール　　

macOSにPostgreSQLをインストールするには、Homebrewを使用します。(macのターミナルで実行)
→俺は権限系でエラーなったからchatgptに聞いて権限変えた。（フォルダを書き換える権利がない的な。）

```sh
brew install postgresql
brew services start postgresql
```

### postgresにデータベースを作成　　

```sh
psql -U postgres
CREATE DATABASE mydatabase;
CREATE USER myuser WITH PASSWORD 'mypassword';
ALTER ROLE myuser SET client_encoding TO 'utf8';
GRANT ALL PRIVILEGES ON DATABASE mydatabase TO myuser;
```

psql -U postgresができない場合は以下記事を参照
https://lifehack.world/postgresql-fatal-role-postgres-does-not-exist/

### postgreへのログインコマンド　　

myuserがmydatabaseにアクセスする。

具体的な動き：postgresの中に、mydatabase（データベース）を作成してmyuser（ユーザー名）でログインする。
→好きなユーザー名にしても良いけどその場合はソースコードのapplication.propertiesの値も変えなあかん。

```sh
psql -U myuser -d mydatabase
```

### テキトーなデータの登録（何でも良い）　　

以下のSQLコマンドを実行して、`users`テーブルにデータを挿入。

```sql
INSERT INTO users (email, username) VALUES ('john.doe@example.com', 'johndoe');
INSERT INTO users (email, username) VALUES ('jane.smith@example.com', 'janesmith');
INSERT INTO users (email, username) VALUES ('bob.jones@example.com', 'bobjones');
```
## アプリケーションを動かしてみる　　

1. `spring-thymeleaf-app/src/main/java/com/example/spring_thymeleaf_app/SpringThymeleafAppApplication.java`のmainメソッドを実行
2. 実行後、テキトーなブラウザでhttp://localhost:8080/usersを入力
3. usersテーブルの値がブラウザに表示されたら動作確認クリアー👍
