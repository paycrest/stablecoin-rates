import { DataTypes, UUIDV4 } from 'sequelize';
import { Column, IsUUID, Model, PrimaryKey, Table } from 'sequelize-typescript';

@Table({
  timestamps: true,
  paranoid: true,
})
export class Rate extends Model {
  @IsUUID('4')
  @PrimaryKey
  @Column({
    defaultValue: UUIDV4,
    type: DataTypes.STRING,
  })
  public id: string;

  @Column({ type: DataTypes.STRING, allowNull: false })
  public fiat: string;

  @Column({ type: DataTypes.STRING, allowNull: false })
  public stablecoin: string;

  @Column({ type: DataTypes.STRING, allowNull: false })
  public rate: string;

  @Column({ type: DataTypes.STRING, allowNull: false })
  public provider: string;
}
