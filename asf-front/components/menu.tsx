'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef } from 'react';
import { itemAtivo, type ItemMenu } from '@/lib/menu';
import { sair } from '@/app/(sistema)/acoes';
import { SeletorTema } from './seletor-tema';

function Item({ item, caminho }: { item: ItemMenu; caminho: string }) {
  if (item.emBreve) {
    return (
      <span className="item-menu" data-em-breve aria-disabled="true">
        {item.rotulo}
        <span className="selo">em breve</span>
      </span>
    );
  }
  return (
    <Link
      className="item-menu"
      href={item.rota}
      aria-current={itemAtivo(item.rota, caminho) ? 'page' : undefined}
    >
      {item.rotulo}
    </Link>
  );
}

function BotaoSair() {
  return (
    <form action={sair}>
      <button className="botao" data-tipo="texto" type="submit">
        Sair
      </button>
    </form>
  );
}

/** Barra lateral (computador), barra inferior e folha "Mais" (celular): mesma lista. */
export function Menu({ itens, nome }: { itens: ItemMenu[]; nome: string }) {
  const caminho = usePathname();
  const folha = useRef<HTMLDialogElement>(null);
  const noCelular = itens.filter((i) => i.celular);
  const naFolha = itens.filter((i) => !i.celular);

  return (
    <>
      <nav className="menu-lateral" aria-label="Menu principal">
        <span className="marca-nome">Associação São Francisco</span>
        {itens.map((item) => (
          <Item key={item.rota} item={item} caminho={caminho} />
        ))}
        <div className="rodape-menu pilha" data-e="2">
          <span className="ajuda">{nome}</span>
          <div className="linha" data-separar>
            <SeletorTema />
            <BotaoSair />
          </div>
        </div>
      </nav>

      <nav className="barra-celular" aria-label="Menu principal">
        {noCelular.map((item) =>
          item.emBreve ? (
            <span key={item.rota} data-em-breve aria-disabled="true">
              {item.rotulo}
            </span>
          ) : (
            <Link
              key={item.rota}
              href={item.rota}
              aria-current={itemAtivo(item.rota, caminho) ? 'page' : undefined}
            >
              {item.rotulo}
            </Link>
          ),
        )}
        <button type="button" onClick={() => folha.current?.showModal()}>
          Mais
        </button>
      </nav>

      <dialog
        ref={folha}
        className="folha"
        aria-label="Mais opções"
        onClick={(e) => {
          if (e.target === e.currentTarget) folha.current?.close();
        }}
      >
        <div className="pilha" data-e="2" onClick={() => folha.current?.close()}>
          {naFolha.map((item) => (
            <Item key={item.rota} item={item} caminho={caminho} />
          ))}
          <div className="linha" data-separar>
            <SeletorTema />
            <BotaoSair />
          </div>
        </div>
      </dialog>
    </>
  );
}
